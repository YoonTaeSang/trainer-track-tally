import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Info } from "lucide-react";
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
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useSchedules, usePublicTrainers, type Schedule } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  fetchAvailability,
  fetchTimeOff,
  slotsFor,
  toDateStr,
  type Availability,
  type TimeOff,
} from "@/lib/availability";
import { isAtLeastOneDayAhead } from "@/components/booking-request-button";

export const Route = createFileRoute("/member/booking")({
  component: MyScheduleMemberPage,
  head: () => ({ meta: [{ title: "내 일정 | PT Studio" }] }),
});

type RequestRow = {
  id: string;
  original_schedule_id: string | null;
  request_type: "cancel" | "change";
  requested_date: string | null;
  requested_time: string | null;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  original_date: string;
  original_time: string;
  created_at: string;
};

function MyScheduleMemberPage() {
  const { user } = useAuth();
  const [members] = useMembers();
  const [schedules] = useSchedules();
  const [trainers] = usePublicTrainers();
  const [profileName, setProfileName] = useState("");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);

  // change-request dialog state
  const [changing, setChanging] = useState<Schedule | null>(null);
  const [reqDate, setReqDate] = useState<string>(toDateStr(new Date()));
  const [reqTime, setReqTime] = useState<string | null>(null);
  const [reqMessage, setReqMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [dlgMonth, setDlgMonth] = useState<Date>(() => startOfMonth(new Date()));

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfileName(data?.name ?? ""));
  }, [user]);

  const myMember = useMemo(() => {
    if (user?.id) {
      const byUserId = members.find((m) => m.userId === user.id);
      if (byUserId) return byUserId;
    }
    if (profileName) {
      return members.find((m) => m.name === profileName) ?? null;
    }
    return null;
  }, [members, profileName, user]);

  const myTrainer = useMemo(
    () => (myMember?.trainerId ? trainers.find((t) => t.id === myMember.trainerId) ?? null : null),
    [myMember, trainers]
  );

  const loadRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("schedule_requests")
      .select(
        "id, original_schedule_id, request_type, requested_date, requested_time, status, reject_reason, original_date, original_time, created_at"
      )
      .eq("member_user_id", user.id)
      .order("created_at", { ascending: false });
    setRequests((data ?? []) as RequestRow[]);
  }, [user]);

  useEffect(() => {
    loadRequests();
    if (!user) return;
    const ch = supabase
      .channel(`mybook_reqs:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_requests",
          filter: `member_user_id=eq.${user.id}`,
        },
        () => loadRequests()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, loadRequests]);

  // load trainer availability when changing dialog opens
  useEffect(() => {
    if (!changing || !myTrainer) return;
    console.log("[booking] dialog open, trainer:", { id: myTrainer.id, name: myTrainer.name });
    Promise.all([fetchAvailability(myTrainer.id), fetchTimeOff(myTrainer.id)])
      .then(([a, t]) => {
        console.log("[booking] availability rows:", a.length, "timeOff rows:", t.length);
        setAvailability(a);
        setTimeOff(t);
      })
      .catch((e) => {
        console.error("[booking] fetch availability/timeOff error:", e);
        toast.error(e instanceof Error ? e.message : "가용 시간 조회 실패");
      });
  }, [changing, myTrainer]);

  const myUpcomingSchedules = useMemo(() => {
    if (!myMember) return [];
    const todayStr = toDateStr(new Date());
    return schedules
      .filter((s) => s.memberId === myMember.id && s.attended === null && s.date >= todayStr)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [schedules, myMember]);

  const pendingByScheduleId = useMemo(() => {
    const m = new Map<string, RequestRow>();
    for (const r of requests) {
      if (r.status === "pending" && r.original_schedule_id) {
        if (!m.has(r.original_schedule_id)) m.set(r.original_schedule_id, r);
      }
    }
    return m;
  }, [requests]);

  // Slots for selected change-request date
  const candidateSlots = useMemo(() => {
    if (!changing || !myTrainer) return [];
    const all = slotsFor(myTrainer.id, reqDate, availability, timeOff);
    const trainerMemberIds = new Set(
      members.filter((m) => m.trainerId === myTrainer.id).map((m) => m.id)
    );
    const taken = new Set(
      schedules
        .filter((s) => s.date === reqDate && trainerMemberIds.has(s.memberId) && s.id !== changing.id)
        .map((s) => s.time)
    );
    return all.map((slot) => ({ slot, taken: taken.has(slot) }));
  }, [changing, myTrainer, reqDate, availability, timeOff, members, schedules]);

  const openChange = (s: Schedule) => {
    if (!isAtLeastOneDayAhead(s.date, s.time)) {
      toast.error("수업 1일 전까지만 변경 신청 가능합니다.");
      return;
    }
    setChanging(s);
    setReqDate(s.date);
    setReqTime(null);
    setReqMessage("");
    setDlgMonth(startOfMonth(new Date(`${s.date}T00:00:00`)));
  };

  // Build day-level availability map for the change-request dialog calendar.
  const dlgDays = useMemo(() => {
    const first = startOfMonth(dlgMonth);
    const last = endOfMonth(dlgMonth);
    return eachDayOfInterval({
      start: startOfWeek(first, { weekStartsOn: 0 }),
      end: endOfWeek(last, { weekStartsOn: 0 }),
    });
  }, [dlgMonth]);

  const dlgStatusFor = (d: Date): "off" | "available" | "none" => {
    if (!myTrainer) return "none";
    const ds = toDateStr(d);
    if (timeOff.some((t) => t.trainer_id === myTrainer.id && t.date === ds)) return "off";
    const slots = slotsFor(myTrainer.id, ds, availability, timeOff);
    if (slots.length > 0) return "available";
    return "none";
  };

  const todayStrForCal = toDateStr(new Date());

  const submitChange = async () => {
    if (!changing || !user || !myMember || !reqTime) {
      toast.error("새 시간을 선택해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const trainerUserId = myTrainer?.userId ?? null;
      const trimmedMessage = reqMessage.trim();
      const { error } = await supabase.from("schedule_requests").insert({
        member_user_id: user.id,
        trainer_user_id: trainerUserId,
        member_name: myMember.name,
        trainer_name: myTrainer?.name ?? null,
        original_schedule_id: changing.id,
        original_date: changing.date,
        original_time: changing.time,
        request_type: "change",
        requested_date: reqDate,
        requested_time: reqTime,
        message: trimmedMessage || null,
      });
      if (error) throw error;
      if (trainerUserId) {
        const bodyBase = `${myMember.name} · ${changing.date} ${changing.time} → ${reqDate} ${reqTime}`;
        await supabase.from("notifications").insert({
          user_id: trainerUserId,
          type: "trainer_message",
          title: "변경 신청",
          body: trimmedMessage ? `${bodyBase}\n메시지: ${trimmedMessage}` : bodyBase,
        });
      }
      toast.success("변경 요청이 접수되었습니다. 트레이너 승인을 기다려주세요.");
      setChanging(null);
      setReqMessage("");
      loadRequests();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  if (!myMember) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          연결된 회원 정보를 찾을 수 없습니다.
        </CardContent>
      </Card>
    );
  }

  const remain = myMember.totalSessions - myMember.usedSessions;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">내 일정</h1>
          <p className="text-xs text-muted-foreground">담당: {myTrainer?.name ?? "미배정"}</p>
        </div>
        <Badge variant={remain <= 2 ? "destructive" : "secondary"}>잔여 {remain}회</Badge>
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          PT 일정은 트레이너가 직접 등록합니다. 일정 변경이 필요하면 아래 "변경 요청" 버튼을
          이용해주세요. (수업 1일 전까지 신청 가능)
        </span>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-4">
          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <CalendarClock className="h-3 w-3" /> 등록된 내 PT 일정
          </p>
          {myUpcomingSchedules.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              예정된 일정이 없습니다.
            </p>
          ) : (
            myUpcomingSchedules.map((s) => {
              const pending = pendingByScheduleId.get(s.id);
              const canRequest = isAtLeastOneDayAhead(s.date, s.time);
              return (
                <div key={s.id} className="rounded-lg border p-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        {s.date} {s.time}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {myTrainer?.name ?? "트레이너"}
                      </p>
                    </div>
                    {pending ? (
                      <Badge variant="secondary">
                        승인 대기중 ({pending.request_type === "cancel" ? "취소" : "변경"})
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        disabled={!canRequest}
                        onClick={() => openChange(s)}
                      >
                        변경 요청
                      </Button>
                    )}
                  </div>
                  {pending && pending.request_type === "change" && (
                    <p className="mt-1 text-[11px] text-primary">
                      → 요청: {pending.requested_date} {pending.requested_time}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Recent rejected */}
      {requests
        .filter((r) => r.status === "rejected")
        .slice(0, 2)
        .map((r) => (
          <div
            key={r.id}
            className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs"
          >
            <p className="font-semibold text-destructive">변경 신청 거절됨</p>
            <p className="text-muted-foreground">
              {r.original_date} {r.original_time}
            </p>
            {r.reject_reason && <p className="mt-1">사유: {r.reject_reason}</p>}
          </div>
        ))}

      {/* Change-request dialog */}
      <Dialog open={!!changing} onOpenChange={(v) => !v && setChanging(null)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>일정 변경 요청</DialogTitle>
            <DialogDescription>
              트레이너 가능 시간 내에서만 선택할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          {changing && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                기존: {changing.date} {changing.time}
              </p>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-xs">새 날짜</Label>
                  <div className="flex items-center gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setDlgMonth((m) => addMonths(m, -1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-1 text-xs font-medium">
                      {format(dlgMonth, "yyyy년 M월")}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setDlgMonth((m) => addMonths(m, 1))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mb-1 grid grid-cols-7 gap-0.5">
                  {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
                    <div key={w} className="py-0.5 text-center text-[10px] font-medium text-muted-foreground">
                      {w}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {dlgDays.map((d) => {
                    const ds = toDateStr(d);
                    const status = dlgStatusFor(d);
                    const inMonth = isSameMonth(d, dlgMonth);
                    const isPast = ds < todayStrForCal;
                    const isToday = isSameDay(d, new Date());
                    const selected = reqDate === ds;
                    const clickable = inMonth && !isPast && status === "available";
                    return (
                      <button
                        type="button"
                        key={ds}
                        disabled={!clickable}
                        onClick={() => {
                          setReqDate(ds);
                          setReqTime(null);
                        }}
                        className={cn(
                          "relative flex aspect-square flex-col items-center justify-center rounded-md border text-[11px] transition",
                          !inMonth && "opacity-30",
                          isPast && "opacity-40",
                          selected && "ring-2 ring-primary ring-offset-1",
                          status === "available" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                          status === "off" && "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
                          status === "none" && "border-border bg-background text-muted-foreground",
                          clickable && "cursor-pointer hover:brightness-95",
                          !clickable && "cursor-not-allowed"
                        )}
                      >
                        <span className={cn("font-medium", isToday && "underline")}>{format(d, "d")}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded border border-emerald-500/40 bg-emerald-500/15" /> 가능
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded border border-rose-500/40 bg-rose-500/15" /> 예약 불가
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded border bg-background" /> 미설정
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-xs">새 시간 ({reqDate})</Label>
                {availability.length === 0 && timeOff.length === 0 ? (
                  <p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    트레이너가 아직 가능 시간을 설정하지 않았습니다.
                  </p>
                ) : candidateSlots.length === 0 ? (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    이 날에는 트레이너 가능 시간이 없습니다 (예약 불가 또는 미설정).
                  </p>
                ) : (
                  <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto p-0.5">
                    {candidateSlots.map(({ slot, taken }) => {
                      const active = reqTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={taken}
                          onClick={() => setReqTime(slot)}
                          className={`flex items-center justify-center gap-1 rounded-md border px-1 py-1.5 text-xs transition ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : taken
                              ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
                              : "border-border bg-background hover:bg-accent"
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs">트레이너에게 메시지 (선택)</Label>
                <Textarea
                  value={reqMessage}
                  onChange={(e) => setReqMessage(e.target.value.slice(0, 200))}
                  placeholder="변경 사유나 요청사항을 적어주세요"
                  rows={3}
                  className="mt-1 text-xs"
                />
                <p className="mt-1 text-right text-[10px] text-muted-foreground">
                  {reqMessage.length}/200
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setChanging(null)}>
              취소
            </Button>
            <Button onClick={submitChange} disabled={submitting || !reqTime}>
              요청 보내기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
