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

// 시간 슬롯 06:00 ~ 22:00, 10분 단위 (총 96 슬롯)
const HOURS = Array.from({ length: 16 }, (_, i) => 6 + i); // [6..21]
const SLOTS_PER_HOUR = 6; // 10분 단위
const TOTAL_SLOTS = HOURS.length * SLOTS_PER_HOUR;
const pad2 = (n: number) => String(n).padStart(2, "0");
const idxToHour = (idx: number) => 6 + Math.floor(idx / SLOTS_PER_HOUR);
const idxToMin = (idx: number) => (idx % SLOTS_PER_HOUR) * 10;
const idxToTime = (idx: number) => `${pad2(idxToHour(idx))}:${pad2(idxToMin(idx))}`;
const idxToEndTime = (idx: number) => {
  const h = idxToHour(idx);
  const m = idxToMin(idx) + 10;
  return m === 60 ? `${pad2(h + 1)}:00` : `${pad2(h)}:${pad2(m)}`;
};
// 연속된 슬롯 인덱스 배열을 시작/종료 시간 범위로 병합
function mergeIdxRanges(indices: number[]): Array<{ start: string; end: string }> {
  if (indices.length === 0) return [];
  const sorted = [...indices].sort((a, b) => a - b);
  const out: Array<{ start: string; end: string }> = [];
  let s = sorted[0];
  let e = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === e + 1) {
      e = sorted[i];
    } else {
      out.push({ start: idxToTime(s), end: idxToEndTime(e) });
      s = e = sorted[i];
    }
  }
  out.push({ start: idxToTime(s), end: idxToEndTime(e) });
  return out;
}

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

  // 슬롯 드래그 선택 (인덱스 0..95)
  const [dragging, setDragging] = useState<{
    startIdx: number;
    endIdx: number;
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

  // 특정 10분 슬롯(idx 0..95)의 상태 판정
  // 수업이 있는 시간은 1시간 통째로 booked 처리 (그 시간대 6슬롯 모두 booked)
  const getSlotStatus = useCallback(
    (date: string, idx: number): SlotStatus => {
      const hour = idxToHour(idx);
      const slotStart = idxToTime(idx);
      const slotEnd = idxToEndTime(idx);

      if (mySchedulesByDateAndHour.get(date)?.get(hour)) return "booked";

      const wholeOff = timeOff.find(
        (t) => t.trainer_id === trainerId && t.date === date && !t.start_time && !t.end_time
      );
      if (wholeOff) return "off";

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

  // ---- 슬롯 클릭/드래그 액션 적용 (10분 슬롯 + 연속 슬롯 자동 병합 저장) ----
  const applyAction = async (
    date: string,
    indices: number[],
    action: "add" | "block" | "delete-off"
  ) => {
    if (!trainerId) return toast.error("트레이너 계정 연결 후 사용 가능합니다.");

    if (action === "add") {
      const targets = indices.filter((i) => getSlotStatus(date, i) === "none");
      const ranges = mergeIdxRanges(targets);
      if (ranges.length === 0) return;
      const wd = new Date(`${date}T00:00:00`).getDay();
      const rows = ranges.map((r) => ({
        trainer_id: trainerId,
        weekday: wd,
        start_time: r.start,
        end_time: r.end,
        specific_date: date,
      }));
      const { error } = await (supabase as any).from("trainer_availability").insert(rows);
      if (error) return toast.error(error.message);
    } else if (action === "block") {
      const targets = indices.filter((i) => getSlotStatus(date, i) === "available");
      const ranges = mergeIdxRanges(targets);
      if (ranges.length === 0) return;
      const rows = ranges.map((r) => ({
        trainer_id: trainerId,
        date,
        reason: "",
        start_time: r.start,
        end_time: r.end,
      }));
      const { error } = await (supabase as any).from("trainer_time_off").insert(rows);
      if (error) return toast.error(error.message);
    } else if (action === "delete-off") {
      const offIds = new Set<string>();
      const availIds = new Set<string>();
      for (const i of indices) {
        if (getSlotStatus(date, i) !== "off") continue;
        const slotStart = idxToTime(i);
        const slotEnd = idxToEndTime(i);
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
          offIds.add(slotOff.id);
          continue;
        }
        const wholeOff = timeOff.find(
          (t) => t.trainer_id === trainerId && t.date === date && !t.start_time && !t.end_time
        );
        if (wholeOff) offIds.add(wholeOff.id);
      }
      // 해제 시 specific_date 가용 row도 함께 제거 → 진짜 "미설정"으로 복귀
      for (const i of indices) {
        const slotStart = idxToTime(i);
        const slotEnd = idxToEndTime(i);
        const ap = availability.find(
          (a) =>
            a.trainer_id === trainerId &&
            a.specific_date === date &&
            a.start_time <= slotStart &&
            a.end_time >= slotEnd
        );
        if (ap) availIds.add(ap.id);
      }
      if (offIds.size > 0) {
        const { error } = await (supabase as any)
          .from("trainer_time_off")
          .delete()
          .in("id", Array.from(offIds));
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

  const handleSlotMouseDown = (idx: number) => {
    if (!selectedDate) return;
    const status = getSlotStatus(selectedDate, idx);
    if (status === "booked") return;
    const action: "add" | "block" | "delete-off" =
      status === "none" ? "add" : status === "available" ? "block" : "delete-off";
    setDragging({ startIdx: idx, endIdx: idx, action });
  };

  const handleSlotMouseEnter = (idx: number) => {
    if (!dragging) return;
    setDragging((d) => (d ? { ...d, endIdx: idx } : null));
  };

  const handleSlotMouseUp = async () => {
    if (!dragging || !selectedDate) return;
    const s = Math.min(dragging.startIdx, dragging.endIdx);
    const e = Math.max(dragging.startIdx, dragging.endIdx);
    const action = dragging.action;
    const indices: number[] = [];
    for (let i = s; i <= e; i++) indices.push(i);
    setDragging(null);
    await applyAction(selectedDate, indices, action);
  };

  const isInDragRange = (idx: number) => {
    if (!dragging) return false;
    const s = Math.min(dragging.startIdx, dragging.endIdx);
    const e = Math.max(dragging.startIdx, dragging.endIdx);
    return idx >= s && idx <= e;
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

          {/* 선택한 날짜의 시간대 그리드 (10분 단위) */}
          {selectedDate && (
            <div className="mt-5 border-t pt-4">
              <p className="mb-2 text-sm font-medium">
                {selectedDate} ({WEEK_LABELS[new Date(`${selectedDate}T00:00:00`).getDay()]}) 시간대
              </p>
              <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded border border-border bg-background" /> 클릭 → 가능
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded border border-emerald-500/40 bg-emerald-500/15" /> 다시 클릭 → 예약 불가
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded border border-rose-500/40 bg-rose-500/15" /> 한번 더 클릭 → 해제
                </span>
              </div>
              <div className="space-y-1" onMouseLeave={() => dragging && setDragging(null)}>
                {HOURS.map((hour) => {
                  const booked = mySchedulesByDateAndHour.get(selectedDate)?.get(hour);
                  const member = booked ? allMembers.find((m) => m.id === booked.memberId) : null;
                  const baseIdx = (hour - 6) * SLOTS_PER_HOUR;
                  return (
                    <div key={hour} className="flex items-center gap-2">
                      <div className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
                        {pad2(hour)}:00
                      </div>
                      {booked ? (
                        <div className="flex h-8 flex-1 items-center justify-center rounded-md border bg-muted px-2 text-xs text-muted-foreground">
                          {member?.name ?? "(회원)"}
                        </div>
                      ) : (
                        <div className="flex flex-1 gap-px">
                          {Array.from({ length: SLOTS_PER_HOUR }).map((_, m) => {
                            const idx = baseIdx + m;
                            const status = getSlotStatus(selectedDate, idx);
                            const inDrag = isInDragRange(idx);
                            return (
                              <button
                                key={m}
                                type="button"
                                title={idxToTime(idx)}
                                onMouseDown={() => handleSlotMouseDown(idx)}
                                onMouseEnter={() => handleSlotMouseEnter(idx)}
                                onMouseUp={handleSlotMouseUp}
                                className={cn(
                                  "h-8 flex-1 border transition select-none first:rounded-l-md last:rounded-r-md",
                                  status === "available" &&
                                    "border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25",
                                  status === "off" &&
                                    "border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25",
                                  status === "none" &&
                                    "border-border bg-background hover:bg-accent",
                                  inDrag && "ring-2 ring-primary"
                                )}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">
                슬롯에 마우스를 올리면 시간 툴팁이 표시되며, 드래그로 여러 슬롯을 한 번에 선택할 수 있습니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
