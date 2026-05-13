import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";
import { useRole } from "@/hooks/use-role";
import { useSchedules, useMembers } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAvailability,
  fetchTimeOff,
  toDateStr,
  WEEK_LABELS,
  type Availability,
  type TimeOff,
} from "@/lib/availability";

export const Route = createFileRoute("/_app/admin/my-schedule")({
  component: MySchedulePage,
  head: () => ({ meta: [{ title: "내 스케줄 설정 | PT Studio" }] }),
});

// 시간 슬롯 06:00 ~ 22:00 (1시간 단위)
const SLOT_HOURS = Array.from({ length: 16 }, (_, i) => 6 + i); // [6..21]
const hourToStr = (h: number) => `${String(h).padStart(2, "0")}:00`;

type SlotStatus = "booked" | "off" | "available" | "none";

function MySchedulePage() {
  const { role } = useRole();
  const { trainerId } = useCurrentTrainer();
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [allMembers] = useMembers();
  const [allSchedules] = useSchedules();

  // 반복 일정 설정 폼 (요일 다중 선택)
  const [repeatWeekdays, setRepeatWeekdays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [repeatStart, setRepeatStart] = useState("06:00");
  const [repeatEnd, setRepeatEnd] = useState("14:00");

  // 예약 불가 (whole-day) 등록 폼
  const [offDate, setOffDate] = useState(toDateStr(new Date()));
  const [offReason, setOffReason] = useState("");

  // 달력
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateStr(new Date()));

  // 슬롯 드래그 선택
  const [dragging, setDragging] = useState<{
    startHour: number;
    endHour: number;
    action: "add" | "block" | "delete-off";
  } | null>(null);

  const load = useCallback(async () => {
    if (!trainerId) {
      setAvailability([]);
      setTimeOff([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [a, t] = await Promise.all([fetchAvailability(trainerId), fetchTimeOff(trainerId)]);
      setAvailability(a);
      setTimeOff(t);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [trainerId]);

  useEffect(() => {
    load();
  }, [load]);

  // 드래그 종료를 윈도우 mouseup으로도 잡음 (다른 곳으로 마우스 빠져나가도 정리)
  useEffect(() => {
    const onUp = () => setDragging(null);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  const myMemberIds = useMemo(
    () => new Set(allMembers.filter((m) => m.trainerId === trainerId).map((m) => m.id)),
    [allMembers, trainerId]
  );

  // 본인 회원의 일정 (date 기준 인덱스)
  const mySchedulesByDateAndHour = useMemo(() => {
    const map = new Map<string, Map<number, { id: string; memberId: string }>>();
    if (!trainerId) return map;
    for (const s of allSchedules) {
      if (!myMemberIds.has(s.memberId)) continue;
      const hour = parseInt(s.time.split(":")[0], 10);
      if (!map.has(s.date)) map.set(s.date, new Map());
      map.get(s.date)!.set(hour, { id: s.id, memberId: s.memberId });
    }
    return map;
  }, [allSchedules, myMemberIds, trainerId]);

  // 특정 슬롯의 상태 판정
  const getSlotStatus = useCallback(
    (date: string, hour: number): SlotStatus => {
      const slotStart = hourToStr(hour);
      const slotEndH = hour + 1;
      const slotEnd = hourToStr(slotEndH);

      // booked
      const booked = mySchedulesByDateAndHour.get(date)?.get(hour);
      if (booked) return "booked";

      // whole-day off
      const wholeOff = timeOff.find(
        (t) => t.trainer_id === trainerId && t.date === date && !t.start_time && !t.end_time
      );
      if (wholeOff) return "off";

      // slot-level off (any overlap on this hour)
      const slotOff = timeOff.find(
        (t) =>
          t.trainer_id === trainerId &&
          t.date === date &&
          t.start_time &&
          t.end_time &&
          (t.start_time as string) < slotEnd &&
          (t.end_time as string) > slotStart
      );
      if (slotOff) return "off";

      // availability (recurring weekly or specific_date)
      const wd = new Date(`${date}T00:00:00`).getDay();
      const hasAvail = availability.some(
        (a) =>
          a.trainer_id === trainerId &&
          ((a.specific_date == null && a.weekday === wd) || a.specific_date === date) &&
          a.start_time <= slotStart &&
          a.end_time >= slotEnd
      );
      if (hasAvail) return "available";

      return "none";
    },
    [availability, timeOff, mySchedulesByDateAndHour, trainerId]
  );

  // ---- 반복 일정 추가 ----
  const saveRepeat = async () => {
    if (!trainerId) return toast.error("트레이너 계정 연결 후 사용 가능합니다.");
    if (repeatWeekdays.size === 0) return toast.error("최소 한 개의 요일을 선택하세요.");
    if (repeatStart >= repeatEnd) return toast.error("종료 시간이 시작 시간보다 늦어야 합니다.");
    const rows = Array.from(repeatWeekdays).map((wd) => ({
      trainer_id: trainerId,
      weekday: wd,
      start_time: repeatStart,
      end_time: repeatEnd,
      specific_date: null as string | null,
    }));
    const { error } = await (supabase as any).from("trainer_availability").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length}개 요일 반복 일정이 추가되었습니다.`);
    load();
  };

  const removeAvailability = async (id: string) => {
    if (!trainerId) return toast.error("트레이너 계정 연결 후 사용 가능합니다.");
    const { error } = await (supabase as any).from("trainer_availability").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  // ---- 예약 불가 (whole-day) ----
  const addTimeOff = async () => {
    if (!trainerId) return toast.error("트레이너 계정 연결 후 사용 가능합니다.");
    if (!offDate) return;
    const { error } = await (supabase as any).from("trainer_time_off").insert({
      trainer_id: trainerId,
      date: offDate,
      reason: offReason.trim(),
      start_time: null,
      end_time: null,
    });
    if (error) return toast.error(error.message);
    toast.success("예약 불가 날짜가 등록되었습니다.");
    setOffReason("");
    load();
  };

  const removeTimeOff = async (id: string) => {
    if (!trainerId) return toast.error("트레이너 계정 연결 후 사용 가능합니다.");
    const { error } = await (supabase as any).from("trainer_time_off").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  // ---- 슬롯 클릭/드래그 액션 적용 ----
  const applyRangeAction = async (
    date: string,
    startH: number,
    endH: number,
    action: "add" | "block" | "delete-off"
  ) => {
    if (!trainerId) return toast.error("트레이너 계정 연결 후 사용 가능합니다.");
    if (action === "add") {
      // 같은 슬롯이 이미 가능 상태면 추가하지 않음
      const rows: any[] = [];
      for (let h = startH; h <= endH; h++) {
        if (getSlotStatus(date, h) !== "none") continue;
        rows.push({
          trainer_id: trainerId,
          weekday: new Date(`${date}T00:00:00`).getDay(),
          start_time: hourToStr(h),
          end_time: hourToStr(h + 1),
          specific_date: date,
        });
      }
      if (rows.length === 0) return;
      const { error } = await (supabase as any).from("trainer_availability").insert(rows);
      if (error) return toast.error(error.message);
    } else if (action === "block") {
      // 가능 슬롯에 슬롯 단위 time-off 추가 (해당 날짜 specific_date 가용 row가 있으면 우선 정리)
      // 단순화를 위해 그냥 timeOff insert로 슬롯을 덮어쓴다
      const rows: any[] = [];
      for (let h = startH; h <= endH; h++) {
        if (getSlotStatus(date, h) !== "available") continue;
        rows.push({
          trainer_id: trainerId,
          date,
          reason: "",
          start_time: hourToStr(h),
          end_time: hourToStr(h + 1),
        });
      }
      if (rows.length === 0) return;
      const { error } = await (supabase as any).from("trainer_time_off").insert(rows);
      if (error) return toast.error(error.message);
    } else if (action === "delete-off") {
      // 슬롯을 덮는 time_off 항목 삭제
      const ids = new Set<string>();
      for (let h = startH; h <= endH; h++) {
        if (getSlotStatus(date, h) !== "off") continue;
        const slotStart = hourToStr(h);
        const slotEnd = hourToStr(h + 1);
        // slot-level off 우선
        const slotOff = timeOff.find(
          (t) =>
            t.trainer_id === trainerId &&
            t.date === date &&
            t.start_time &&
            t.end_time &&
            (t.start_time as string) < slotEnd &&
            (t.end_time as string) > slotStart
        );
        if (slotOff) {
          ids.add(slotOff.id);
          continue;
        }
        // whole-day off
        const wholeOff = timeOff.find(
          (t) => t.trainer_id === trainerId && t.date === date && !t.start_time && !t.end_time
        );
        if (wholeOff) ids.add(wholeOff.id);
      }
      // 같은 날짜의 specific_date 가용 슬롯도 함께 정리 (사용자가 한 번 추가한 뒤 되돌리기 위해)
      const availIds = new Set<string>();
      for (let h = startH; h <= endH; h++) {
        const slotStart = hourToStr(h);
        const slotEnd = hourToStr(h + 1);
        const ap = availability.find(
          (a) =>
            a.trainer_id === trainerId &&
            a.specific_date === date &&
            a.start_time <= slotStart &&
            a.end_time >= slotEnd
        );
        if (ap) availIds.add(ap.id);
      }
      if (ids.size > 0) {
        const { error } = await (supabase as any)
          .from("trainer_time_off")
          .delete()
          .in("id", Array.from(ids));
        if (error) return toast.error(error.message);
      }
      if (availIds.size > 0) {
        const { error } = await (supabase as any)
          .from("trainer_availability")
          .delete()
          .in("id", Array.from(availIds));
        if (error) return toast.error(error.message);
      }
    }
    load();
  };

  const handleSlotMouseDown = (hour: number) => {
    if (!selectedDate) return;
    const status = getSlotStatus(selectedDate, hour);
    if (status === "booked") return;
    const action: "add" | "block" | "delete-off" =
      status === "none" ? "add" : status === "available" ? "block" : "delete-off";
    setDragging({ startHour: hour, endHour: hour, action });
  };

  const handleSlotMouseEnter = (hour: number) => {
    if (!dragging) return;
    setDragging((d) => (d ? { ...d, endHour: hour } : null));
  };

  const handleSlotMouseUp = async () => {
    if (!dragging || !selectedDate) return;
    const s = Math.min(dragging.startHour, dragging.endHour);
    const e = Math.max(dragging.startHour, dragging.endHour);
    const action = dragging.action;
    setDragging(null);
    await applyRangeAction(selectedDate, s, e, action);
  };

  const isInDragRange = (hour: number) => {
    if (!dragging) return false;
    const s = Math.min(dragging.startHour, dragging.endHour);
    const e = Math.max(dragging.startHour, dragging.endHour);
    return hour >= s && hour <= e;
  };

  // ---- 달력 ----
  const calDays = useMemo(() => {
    const first = startOfMonth(calMonth);
    const last = endOfMonth(calMonth);
    return eachDayOfInterval({
      start: startOfWeek(first, { weekStartsOn: 0 }),
      end: endOfWeek(last, { weekStartsOn: 0 }),
    });
  }, [calMonth]);

  // 그날의 본인 회원 수업 건수
  const bookedCountFor = useCallback(
    (date: string): number => mySchedulesByDateAndHour.get(date)?.size ?? 0,
    [mySchedulesByDateAndHour]
  );

  // ---- 가드 ----
  if (role && role !== "trainer" && role !== "admin") {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          접근 권한이 없습니다.
        </CardContent>
      </Card>
    );
  }

  // 반복 일정 리스트 (specific_date null인 row만)
  const recurringRows = availability
    .filter((a) => a.specific_date == null)
    .slice()
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));

  // 전체 예약 불가 리스트 (whole-day만)
  const wholeDayOffs = timeOff
    .filter((t) => !t.start_time && !t.end_time)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">내 스케줄 설정</h1>
        <p className="text-sm text-muted-foreground">
          반복 일정을 설정한 뒤, 달력에서 날짜를 클릭해 시간 단위로 조정할 수 있습니다.
        </p>
      </div>

      {/* 1. 반복 일정 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Repeat className="h-4 w-4" /> 반복 일정 설정 (매주 같은 시간 출근)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">요일 선택</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {WEEK_LABELS.map((w, i) => {
                const on = repeatWeekdays.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setRepeatWeekdays((s) => {
                        const next = new Set(s);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    className={cn(
                      "h-8 w-8 rounded-md border text-xs font-medium transition",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent"
                    )}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label className="text-xs">시작</Label>
              <Input type="time" value={repeatStart} onChange={(e) => setRepeatStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">종료</Label>
              <Input type="time" value={repeatEnd} onChange={(e) => setRepeatEnd(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={saveRepeat} className="w-full">
                <Plus className="mr-1 h-4 w-4" /> 저장
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-medium text-muted-foreground">현재 반복 일정</p>
            {loading ? (
              <p className="text-sm text-muted-foreground">불러오는 중...</p>
            ) : recurringRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 반복 일정이 없습니다.</p>
            ) : (
              recurringRows.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{WEEK_LABELS[a.weekday]}요일</span>
                    <span className="ml-2 text-muted-foreground">
                      {a.start_time} ~ {a.end_time}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeAvailability(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. 예약 불가 (whole-day) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">예약 불가</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <div>
              <Label className="text-xs">날짜</Label>
              <Input type="date" value={offDate} onChange={(e) => setOffDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">사유 (선택)</Label>
              <Input
                value={offReason}
                onChange={(e) => setOffReason(e.target.value.slice(0, 100))}
                placeholder="예: 개인 사정"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addTimeOff} className="w-full">
                <Plus className="mr-1 h-4 w-4" /> 등록
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            {wholeDayOffs.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 예약 불가 날짜가 없습니다.</p>
            ) : (
              wholeDayOffs.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{t.date}</span>
                    {t.reason && <span className="ml-2 text-muted-foreground">· {t.reason}</span>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeTimeOff(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. 월별 달력 + 선택 날짜 슬롯 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {format(calMonth, "yyyy년 M월")}
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCalMonth((m) => addMonths(m, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setCalMonth(startOfMonth(new Date()))}>
                이번달
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCalMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              초록 · 가능
            </Badge>
            <Badge variant="secondary" className="bg-rose-500/15 text-rose-700 dark:text-rose-300">
              빨강 · 예약 불가
            </Badge>
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              회색 · 수업
            </Badge>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
              <div key={w} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calDays.map((d) => {
              const ds = toDateStr(d);
              const today = isSameDay(d, new Date());
              const inMonth = isSameMonth(d, calMonth);
              const isSelected = selectedDate === ds;
              const bookedCount = bookedCountFor(ds);
              return (
                <button
                  key={ds}
                  type="button"
                  onClick={() => setSelectedDate(ds)}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center rounded-md border bg-background p-1 text-xs text-foreground transition hover:bg-accent",
                    !inMonth && "opacity-30",
                    today && "ring-1 ring-primary",
                    isSelected && "ring-2 ring-primary ring-offset-1"
                  )}
                >
                  <span className="font-semibold">{format(d, "d")}</span>
                  {bookedCount > 0 && (
                    <span className="mt-0.5 text-[9px] leading-tight text-muted-foreground">
                      수업 {bookedCount}건
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 선택한 날짜의 시간대 그리드 */}
          {selectedDate && (
            <div className="mt-5 border-t pt-4">
              <p className="mb-2 text-sm font-medium">
                {selectedDate} ({WEEK_LABELS[new Date(`${selectedDate}T00:00:00`).getDay()]}) 시간대
              </p>
              <p className="mb-3 text-[11px] text-muted-foreground">
                슬롯을 클릭/드래그해 가능 시간 추가, 예약 불가 변경, 해제할 수 있습니다.
              </p>
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-8" onMouseLeave={() => dragging && setDragging(null)}>
                {SLOT_HOURS.map((h) => {
                  const status = getSlotStatus(selectedDate, h);
                  const booked = mySchedulesByDateAndHour.get(selectedDate)?.get(h);
                  const member = booked ? allMembers.find((m) => m.id === booked.memberId) : null;
                  const inDrag = isInDragRange(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={status === "booked"}
                      onMouseDown={() => handleSlotMouseDown(h)}
                      onMouseEnter={() => handleSlotMouseEnter(h)}
                      onMouseUp={handleSlotMouseUp}
                      className={cn(
                        "flex min-h-14 flex-col items-center justify-center rounded-md border p-1 text-[11px] transition select-none",
                        status === "available" && "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:brightness-95",
                        status === "off" && "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:brightness-95",
                        status === "booked" && "bg-muted text-muted-foreground cursor-not-allowed",
                        status === "none" && "bg-background text-foreground hover:bg-accent",
                        inDrag && "ring-2 ring-primary"
                      )}
                    >
                      <span className="font-semibold">{hourToStr(h)}</span>
                      {status === "booked" && member && (
                        <span className="mt-0.5 max-w-full truncate text-[9px] leading-tight">{member.name}</span>
                      )}
                      {status === "available" && (
                        <span className="mt-0.5 text-[9px] leading-tight">가능</span>
                      )}
                      {status === "off" && (
                        <span className="mt-0.5 text-[9px] leading-tight">예약 불가</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                흰색 슬롯 클릭 → 가능 시간 추가 · 가능 슬롯 클릭 → 예약 불가 · 예약 불가 슬롯 클릭 → 해제
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
