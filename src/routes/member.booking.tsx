import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, Clock, Info } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useSchedules, usePublicTrainers, type Schedule } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
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
  const [submitting, setSubmitting] = useState(false);

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
    if (!profileName) return members[0];
    return members.find((m) => m.name === profileName) ?? members[0];
  }, [members, profileName]);

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
    Promise.all([fetchAvailability(myTrainer.id), fetchTimeOff(myTrainer.id)])
      .then(([a, t]) => {
        setAvailability(a);
        setTimeOff(t);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "가용 시간 조회 실패"));
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
  };

  const submitChange = async () => {
    if (!changing || !user || !myMember || !reqTime) {
      toast.error("새 시간을 선택해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const trainerUserId = myTrainer?.userId ?? null;
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
      });
      if (error) throw error;
      if (trainerUserId) {
        await supabase.from("notifications").insert({
          user_id: trainerUserId,
          type: "trainer_message",
          title: "변경 신청",
          body: `${myMember.name} · ${changing.date} ${changing.time} → ${reqDate} ${reqTime}`,
        });
      }
      toast.success("변경 요청이 접수되었습니다. 트레이너 승인을 기다려주세요.");
      setChanging(null);
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
                <Label className="text-xs">새 날짜</Label>
                <Input
                  type="date"
                  value={reqDate}
                  min={toDateStr(new Date())}
                  onChange={(e) => {
                    setReqDate(e.target.value);
                    setReqTime(null);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">새 시간</Label>
                {candidateSlots.length === 0 ? (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    이 날에는 트레이너 가능 시간이 없습니다 (휴무 또는 미설정).
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
