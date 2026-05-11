import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Clock, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useSchedules, useTrainers, uid } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { BookingRequestButtons } from "@/components/booking-request-button";

export const Route = createFileRoute("/member/booking")({
  component: BookingPage,
  head: () => ({ meta: [{ title: "예약 | PT Studio" }] }),
});

const OPERATING_HOURS = Array.from({ length: 13 }, (_, i) => `${String(i + 9).padStart(2, "0")}:00`);
const WEEK = ["일", "월", "화", "수", "목", "금", "토"] as const;

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

function BookingPage() {
  const { user } = useAuth();
  const [members, setMembers] = useMembers();
  const [schedules, setSchedules] = useSchedules();
  const [trainers] = useTrainers();
  const [profileName, setProfileName] = useState("");
  const [requests, setRequests] = useState<RequestRow[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfileName(data?.name ?? ""));
  }, [user]);

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
      .channel(`booking_requests:${user.id}`)
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

  const myMember = useMemo(() => {
    if (!profileName) return members[0];
    return members.find((m) => m.name === profileName) ?? members[0];
  }, [members, profileName]);

  const myTrainer = useMemo(
    () => (myMember?.trainerId ? trainers.find((t) => t.id === myMember.trainerId) ?? null : null),
    [myMember, trainers]
  );

  const dates = useMemo(() => {
    const arr: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => toDateStr(new Date()));
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);

  const takenTimes = useMemo(() => {
    if (!myTrainer) return new Set<string>();
    const trainerMemberIds = new Set(
      members.filter((m) => m.trainerId === myTrainer.id).map((m) => m.id)
    );
    return new Set(
      schedules
        .filter((s) => s.date === selectedDate && trainerMemberIds.has(s.memberId))
        .map((s) => s.time)
    );
  }, [schedules, members, myTrainer, selectedDate]);

  const myBookedTimes = useMemo(() => {
    if (!myMember) return new Set<string>();
    return new Set(
      schedules.filter((s) => s.date === selectedDate && s.memberId === myMember.id).map((s) => s.time)
    );
  }, [schedules, myMember, selectedDate]);

  const remain = myMember ? myMember.totalSessions - myMember.usedSessions : 0;

  const confirmBooking = () => {
    if (!pendingSlot || !myMember) return;
    if (remain <= 0) {
      toast.error("잔여 세션이 부족합니다. 충전 후 이용해주세요.");
      setPendingSlot(null);
      return;
    }
    setSchedules((prev) => [
      ...prev,
      { id: uid(), memberId: myMember.id, date: selectedDate, time: pendingSlot, attended: null },
    ]);
    setMembers((prev) =>
      prev.map((m) => (m.id === myMember.id ? { ...m, usedSessions: m.usedSessions + 1 } : m))
    );
    toast.success(`${selectedDate} ${pendingSlot} 예약이 완료되었습니다.`);
    setPendingSlot(null);
  };

  // Map original_schedule_id -> latest pending request
  const pendingByScheduleId = useMemo(() => {
    const m = new Map<string, RequestRow>();
    for (const r of requests) {
      if (r.status === "pending" && r.original_schedule_id) {
        if (!m.has(r.original_schedule_id)) m.set(r.original_schedule_id, r);
      }
    }
    return m;
  }, [requests]);

  const myUpcomingSchedules = useMemo(() => {
    if (!myMember) return [];
    const todayStr = toDateStr(new Date());
    return schedules
      .filter((s) => s.memberId === myMember.id && s.attended === null && s.date >= todayStr)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [schedules, myMember]);

  if (!myMember) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          연결된 회원 정보를 찾을 수 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">PT 예약</h1>
          <p className="text-xs text-muted-foreground">담당: {myTrainer?.name ?? "미배정"}</p>
        </div>
        <Badge variant={remain <= 2 ? "destructive" : "secondary"}>잔여 {remain}회</Badge>
      </div>

      {/* My upcoming schedules with cancel/change */}
      {myUpcomingSchedules.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-4">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <CalendarClock className="h-3 w-3" /> 예정된 내 예약
            </p>
            {myUpcomingSchedules.map((s) => {
              const pending = pendingByScheduleId.get(s.id);
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
                      user && (
                        <BookingRequestButtons
                          schedule={s}
                          member={myMember}
                          trainer={myTrainer}
                          userId={user.id}
                          onSubmitted={loadRequests}
                        />
                      )
                    )}
                  </div>
                  {pending && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      승인 처리가 지연될 경우, 트레이너에게 개별문의해 주시기 바랍니다.
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 최근 거절된 신청 */}
      {requests.filter((r) => r.status === "rejected").slice(0, 2).map((r) => (
        <div
          key={r.id}
          className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs"
        >
          <p className="font-semibold text-destructive">
            {r.request_type === "cancel" ? "취소" : "변경"} 신청 거절됨
          </p>
          <p className="text-muted-foreground">
            {r.original_date} {r.original_time}
          </p>
          {r.reject_reason && <p className="mt-1">사유: {r.reject_reason}</p>}
        </div>
      ))}

      {/* 날짜 가로 스크롤 */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2 pb-1">
          {dates.map((d) => {
            const ds = toDateStr(d);
            const active = ds === selectedDate;
            const dow = WEEK[d.getDay()];
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <button
                key={ds}
                type="button"
                onClick={() => setSelectedDate(ds)}
                className={`flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-xs transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent"
                }`}
              >
                <span
                  className={`text-[10px] ${
                    active ? "opacity-90" : isWeekend ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {dow}
                </span>
                <span className="text-base font-bold">{d.getDate()}</span>
                <span className={`text-[10px] ${active ? "opacity-80" : "text-muted-foreground"}`}>
                  {d.getMonth() + 1}월
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {selectedDate} 예약 가능 시간
          </p>
          {OPERATING_HOURS.map((time) => {
            const taken = takenTimes.has(time);
            const mine = myBookedTimes.has(time);
            return (
              <button
                key={time}
                type="button"
                disabled={taken}
                onClick={() => setPendingSlot(time)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition ${
                  mine
                    ? "border-primary/50 bg-primary/5"
                    : taken
                    ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
                    : "border-border bg-background hover:border-primary hover:bg-accent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold">{time}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {myTrainer?.name ?? "트레이너 미배정"}
                    </p>
                  </div>
                </div>
                {mine ? (
                  <Badge>내 예약</Badge>
                ) : taken ? (
                  <Badge variant="outline">마감</Badge>
                ) : (
                  <Badge variant="secondary">예약가능</Badge>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!pendingSlot} onOpenChange={(v) => !v && setPendingSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" /> 예약 확인
            </DialogTitle>
            <DialogDescription>
              아래 일정으로 PT를 예약합니다. 잔여 세션이 1회 차감됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">날짜 · </span>
              <span className="font-medium">{selectedDate}</span>
            </p>
            <p>
              <span className="text-muted-foreground">시간 · </span>
              <span className="font-medium">{pendingSlot}</span>
            </p>
            <p>
              <span className="text-muted-foreground">트레이너 · </span>
              <span className="font-medium">{myTrainer?.name ?? "미배정"}</span>
            </p>
            <p className="pt-1 text-xs text-muted-foreground">
              현재 잔여 {remain}회 → 예약 후 {Math.max(remain - 1, 0)}회
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingSlot(null)}>
              취소
            </Button>
            <Button onClick={confirmBooking}>예약 신청</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
