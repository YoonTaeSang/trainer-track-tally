import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Calendar,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  X,
  EyeOff,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMembers, useSchedules } from "@/lib/store";
import { useRole } from "@/hooks/use-role";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";
import { supabase } from "@/integrations/supabase/client";

import { MonthTimeline } from "@/components/month-timeline";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "관리자 대시보드 | PT Studio" }] }),
});

const ALERT_KEY = "dashboard_session_alert_dismissed";
const LOW_HIDE_KEY = "dashboard_low_session_hidden";

function AdminDashboard() {
  const [members, setMembers] = useMembers();
  const [schedules] = useSchedules();
  const { role } = useRole();
  const { trainerId: currentTrainerId } = useCurrentTrainer();
  const isTrainer = role === "trainer";

  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  // 닫기 상태 (localStorage 기반, 오늘 날짜와 비교)
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [lowHidden, setLowHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAlertDismissed(localStorage.getItem(ALERT_KEY) === today);
    setLowHidden(localStorage.getItem(LOW_HIDE_KEY) === today);
  }, [today]);

  const dismissAlert = () => {
    localStorage.setItem(ALERT_KEY, today);
    setAlertDismissed(true);
  };
  const hideLow = () => {
    localStorage.setItem(LOW_HIDE_KEY, today);
    setLowHidden(true);
  };
  const showLow = () => {
    localStorage.removeItem(LOW_HIDE_KEY);
    setLowHidden(false);
  };

  // 트레이너면 본인 담당 회원으로 한정
  const scopedMembers = useMemo(() => {
    if (isTrainer) {
      return currentTrainerId
        ? members.filter((m) => m.trainerId === currentTrainerId)
        : [];
    }
    return members;
  }, [members, isTrainer, currentTrainerId]);

  const scopedMemberIds = useMemo(
    () => new Set(scopedMembers.map((m) => m.id)),
    [scopedMembers]
  );

  const scopedSchedules = useMemo(
    () => (isTrainer ? schedules.filter((s) => scopedMemberIds.has(s.memberId)) : schedules),
    [schedules, isTrainer, scopedMemberIds]
  );

  const stats = useMemo(() => {
    const todaySchedules = scopedSchedules.filter((s) => s.date === today);
    const monthSchedules = scopedSchedules.filter((s) => s.date.startsWith(monthPrefix));
    const attended = monthSchedules.filter((s) => s.attended === true).length;
    const completed = monthSchedules.filter((s) => s.attended !== null).length;
    const rate = completed > 0 ? Math.round((attended / completed) * 100) : 0;
    return {
      memberCount: scopedMembers.length,
      todayCount: todaySchedules.length,
      monthAttended: attended,
      attendanceRate: rate,
    };
  }, [scopedMembers, scopedSchedules, today, monthPrefix]);

  const upcoming = useMemo(() => {
    return scopedSchedules
      .filter((s) => s.date >= today && s.attended === null)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 5);
  }, [scopedSchedules, today]);

  // dismissed_at 있는 회원은 알림/카운트에서 제외
  const lowSessions = useMemo(
    () =>
      scopedMembers.filter(
        (m) => !m.dismissedAt && m.totalSessions - m.usedSessions <= 5
      ),
    [scopedMembers]
  );

  const lowCount = lowSessions.length;
  const lowTop = lowSessions.slice(0, 5);

  const dismissMemberAlert = async (memberId: string) => {
    const nowIso = new Date().toISOString();
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, dismissedAt: nowIso } : m))
    );
    const { error } = await supabase
      .from("members")
      .update({ dismissed_at: nowIso })
      .eq("id", memberId);
    if (error) {
      console.error("[dismissMemberAlert]", error);
      toast.error("알림 제외 저장에 실패했습니다.");
    }
  };

  const cards = [
    { label: "전체 회원", value: stats.memberCount, icon: Users, suffix: "명" },
    { label: "오늘 일정", value: stats.todayCount, icon: Calendar, suffix: "건" },
    { label: "이번 달 출석", value: stats.monthAttended, icon: ClipboardCheck, suffix: "회" },
    { label: "출석률", value: stats.attendanceRate, icon: TrendingUp, suffix: "%" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-sm text-muted-foreground">
          {isTrainer ? "본인 담당 회원의 현황입니다." : "PT 샵 운영 현황을 한눈에 확인하세요."}
        </p>
      </div>

      {/* 세션 부족 회원 N명 알림 (닫기 가능, 같은 날엔 다시 안 뜸) */}
      {lowCount > 0 && !alertDismissed && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-destructive">
              세션 부족 회원 {lowCount}명
            </p>
            <p className="text-xs text-muted-foreground">
              잔여 세션 5회 이하 회원이 있습니다. 충전 안내가 필요한지 확인해 주세요.
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={dismissAlert}
            title="오늘 하루 숨기기"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {c.value}
                <span className="ml-1 text-base font-normal text-muted-foreground">{c.suffix}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <MonthTimeline />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>다가오는 일정</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">예정된 일정이 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((s) => {
                  const m = members.find((x) => x.id === s.memberId);
                  return (
                    <li key={s.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{m?.name ?? "(삭제된 회원)"}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.date} · {s.time}
                        </p>
                      </div>
                      <Badge variant="secondary">예정</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {!lowHidden && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>잔여 세션 부족 회원</CardTitle>
              <Button size="sm" variant="ghost" onClick={hideLow} className="h-7 px-2 text-xs">
                <EyeOff className="mr-1 h-3.5 w-3.5" /> 숨기기
              </Button>
            </CardHeader>
            <CardContent>
              {lowTop.length === 0 ? (
                <p className="text-sm text-muted-foreground">충분한 세션을 보유하고 있습니다.</p>
              ) : (
                <ul className="space-y-3">
                  {lowTop.map((m) => {
                    const remain = m.totalSessions - m.usedSessions;
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.phone}</p>
                        </div>
                        <Badge variant={remain <= 2 ? "destructive" : "outline"}>잔여 {remain}회</Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => dismissMemberAlert(m.id)}
                          title="이 회원 알림에서 제외"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {lowHidden && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={showLow} className="text-xs text-muted-foreground">
            <Eye className="mr-1 h-3.5 w-3.5" /> 잔여 세션 부족 회원 다시 보기
          </Button>
        </div>
      )}
    </div>
  );
}
