import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useSchedules, useTrainers, uid } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/member/booking")({
  component: BookingPage,
  head: () => ({ meta: [{ title: "예약 | PT Studio" }] }),
});

// 트레이너 운영 시간: 09:00 ~ 21:00 (1시간 단위) 모든 요일
const OPERATING_HOURS = Array.from({ length: 13 }, (_, i) => `${String(i + 9).padStart(2, "0")}:00`);

const WEEK = ["일", "월", "화", "수", "목", "금", "토"] as const;

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function BookingPage() {
  const { user } = useAuth();
  const [members, setMembers] = useMembers();
  const [schedules, setSchedules] = useSchedules();
  const [trainers] = useTrainers();
  const [profileName, setProfileName] = useState("");

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

  // 다음 14일치 날짜
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

  // 내 트레이너에게 이미 잡힌 시간 (모든 회원 합산)
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
          <p className="text-xs text-muted-foreground">
            담당: {myTrainer?.name ?? "미배정"}
          </p>
        </div>
        <Badge variant={remain <= 2 ? "destructive" : "secondary"}>잔여 {remain}회</Badge>
      </div>

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
                <span className={`text-[10px] ${active ? "opacity-90" : isWeekend ? "text-destructive" : "text-muted-foreground"}`}>
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

      {/* 슬롯 목록 */}
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
