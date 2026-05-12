import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";
import { useRole } from "@/hooks/use-role";
import { useSchedules, useMembers } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAvailability,
  fetchTimeOff,
  slotsFor,
  toDateStr,
  WEEK_LABELS,
  type Availability,
  type TimeOff,
} from "@/lib/availability";

export const Route = createFileRoute("/_app/admin/my-schedule")({
  component: MySchedulePage,
  head: () => ({ meta: [{ title: "내 스케줄 설정 | PT Studio" }] }),
});

function MySchedulePage() {
  const { role } = useRole();
  const { trainerId } = useCurrentTrainer();
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [allMembers] = useMembers();
  const [allSchedules] = useSchedules();

  const [newWeekday, setNewWeekday] = useState("1");
  const [newStart, setNewStart] = useState("06:00");
  const [newEnd, setNewEnd] = useState("14:00");
  const [offDate, setOffDate] = useState(toDateStr(new Date()));
  const [offReason, setOffReason] = useState("");

  const load = useCallback(async () => {
    if (!trainerId) return;
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

  const addAvailability = async () => {
    if (!trainerId) return;
    if (newStart >= newEnd) return toast.error("종료 시간이 시작 시간보다 늦어야 합니다.");
    const { error } = await (supabase as any).from("trainer_availability").insert({
      trainer_id: trainerId,
      weekday: Number(newWeekday),
      start_time: newStart,
      end_time: newEnd,
    });
    if (error) return toast.error(error.message);
    toast.success("시간대가 추가되었습니다.");
    load();
  };

  const removeAvailability = async (id: string) => {
    const { error } = await (supabase as any).from("trainer_availability").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const addTimeOff = async () => {
    if (!trainerId || !offDate) return;
    const { error } = await (supabase as any).from("trainer_time_off").insert({
      trainer_id: trainerId,
      date: offDate,
      reason: offReason.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("휴무일이 등록되었습니다.");
    setOffReason("");
    load();
  };

  const removeTimeOff = async (id: string) => {
    const { error } = await (supabase as any).from("trainer_time_off").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  // Mini-calendar: next 30 days status
  const days30 = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 30 }, (_, i) => addDays(today, i));
  }, []);

  const myMemberIds = useMemo(
    () => new Set(allMembers.filter((m) => m.trainerId === trainerId).map((m) => m.id)),
    [allMembers, trainerId]
  );

  const statusFor = (d: Date): "off" | "booked" | "available" | "none" => {
    if (!trainerId) return "none";
    const ds = toDateStr(d);
    if (timeOff.some((t) => t.date === ds)) return "off";
    const slots = slotsFor(trainerId, ds, availability, timeOff);
    const booked = allSchedules.some(
      (s) => s.date === ds && myMemberIds.has(s.memberId)
    );
    if (booked) return "booked";
    if (slots.length > 0) return "available";
    return "none";
  };

  if (role && role !== "trainer" && role !== "admin") {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          접근 권한이 없습니다.
        </CardContent>
      </Card>
    );
  }
  if (!trainerId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          연결된 트레이너 정보가 없습니다. 관리자에게 문의하세요.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">내 스케줄 설정</h1>
        <p className="text-sm text-muted-foreground">
          요일별 가능 시간과 휴무일을 등록하세요. 회원 변경 요청은 이 시간대 내에서만 신청됩니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">요일별 가능 시간대</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div>
              <Label className="text-xs">요일</Label>
              <Select value={newWeekday} onValueChange={setNewWeekday}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEK_LABELS.map((w, i) => (
                    <SelectItem key={i} value={String(i)}>{w}요일</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">시작</Label>
              <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">종료</Label>
              <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={addAvailability} className="w-full">
                <Plus className="mr-1 h-4 w-4" /> 추가
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            {loading ? (
              <p className="text-sm text-muted-foreground">불러오는 중...</p>
            ) : availability.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 시간대가 없습니다.</p>
            ) : (
              availability
                .slice()
                .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
                .map((a) => (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">휴무일</CardTitle>
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
            {timeOff.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 휴무일이 없습니다.</p>
            ) : (
              timeOff
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{t.date}</span>
                      {t.reason && (
                        <span className="ml-2 text-muted-foreground">· {t.reason}</span>
                      )}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" /> 향후 30일 미리보기
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-3 text-xs">
            <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">초록 · 가능</Badge>
            <Badge variant="secondary" className="bg-rose-500/15 text-rose-700 dark:text-rose-300">빨강 · 휴무</Badge>
            <Badge variant="secondary" className="bg-muted text-muted-foreground">회색 · 예약됨/불가</Badge>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days30.map((d) => {
              const status = statusFor(d);
              const today = isSameDay(d, new Date());
              return (
                <div
                  key={toDateStr(d)}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center rounded-md border text-xs",
                    status === "available" && "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
                    status === "off" && "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300",
                    status === "booked" && "bg-muted text-muted-foreground",
                    status === "none" && "bg-muted/40 text-muted-foreground",
                    today && "ring-1 ring-primary"
                  )}
                  title={`${toDateStr(d)} · ${status}`}
                >
                  <span className="text-[10px]">{WEEK_LABELS[d.getDay()]}</span>
                  <span className="font-semibold">{format(d, "d")}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
