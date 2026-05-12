import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Users, Calendar, ClipboardCheck, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMembers, useSchedules } from "@/lib/store";

import { MonthTimeline } from "@/components/month-timeline";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "관리자 대시보드 | PT Studio" }] }),
});

function AdminDashboard() {
  const [members] = useMembers();
  const [schedules] = useSchedules();

  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  const stats = useMemo(() => {
    const todaySchedules = schedules.filter((s) => s.date === today);
    const monthSchedules = schedules.filter((s) => s.date.startsWith(monthPrefix));
    const attended = monthSchedules.filter((s) => s.attended === true).length;
    const completed = monthSchedules.filter((s) => s.attended !== null).length;
    const rate = completed > 0 ? Math.round((attended / completed) * 100) : 0;
    return {
      memberCount: members.length,
      todayCount: todaySchedules.length,
      monthAttended: attended,
      attendanceRate: rate,
    };
  }, [members, schedules, today, monthPrefix]);

  const upcoming = useMemo(() => {
    return schedules
      .filter((s) => s.date >= today && s.attended === null)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 5);
  }, [schedules, today]);

  const lowSessions = useMemo(
    () => members.filter((m) => m.totalSessions - m.usedSessions <= 5).slice(0, 5),
    [members]
  );

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
        <p className="text-sm text-muted-foreground">PT 샵 운영 현황을 한눈에 확인하세요.</p>
      </div>

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

        <Card>
          <CardHeader>
            <CardTitle>잔여 세션 부족 회원</CardTitle>
          </CardHeader>
          <CardContent>
            {lowSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">충분한 세션을 보유하고 있습니다.</p>
            ) : (
              <ul className="space-y-3">
                {lowSessions.map((m) => {
                  const remain = m.totalSessions - m.usedSessions;
                  return (
                    <li key={m.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.phone}</p>
                      </div>
                      <Badge variant={remain <= 2 ? "destructive" : "outline"}>잔여 {remain}회</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
