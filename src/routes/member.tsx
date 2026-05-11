import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { useMembers, useSchedules, seedDemoData } from "@/lib/store";
import { DEV_BYPASS } from "@/lib/dev-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ClipboardCheck, LogOut, Dumbbell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/member")({
  component: MemberPage,
  head: () => ({ meta: [{ title: "내 PT | PT Studio" }] }),
});

function MemberPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    seedDemoData();
  }, []);

  // Auth guard: redirect non-logged-in to /login
  useEffect(() => {
    if (DEV_BYPASS) return;
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  // Role guard: send admin/trainer to /admin
  useEffect(() => {
    if (DEV_BYPASS) return;
    if (!roleLoading && role && (role === "admin" || role === "trainer")) {
      navigate({ to: "/admin" });
    }
  }, [role, roleLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfileName(data?.name ?? ""));
  }, [user]);

  const [members] = useMembers();
  const [schedules] = useSchedules();

  // Match by name (demo store doesn't link to auth user). Falls back to first member.
  const myDemoMember = useMemo(() => {
    if (!profileName) return members[0];
    return members.find((m) => m.name === profileName) ?? members[0];
  }, [members, profileName]);

  const today = new Date().toISOString().slice(0, 10);

  const mySchedules = useMemo(() => {
    if (!myDemoMember) return [];
    return schedules
      .filter((s) => s.memberId === myDemoMember.id)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [schedules, myDemoMember]);

  const upcoming = mySchedules.filter((s) => s.date >= today && s.attended === null).slice(0, 5);
  const recentAttendance = mySchedules.filter((s) => s.attended !== null).slice(0, 5);

  const handleLogout = async () => {
    await signOut();
    toast.success("로그아웃되었습니다");
    navigate({ to: "/login" });
  };

  if (authLoading || roleLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  const remain = myDemoMember ? myDemoMember.totalSessions - myDemoMember.usedSessions : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/member" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">PT Studio</span>
              <span className="text-xs text-muted-foreground">내 PT</span>
            </div>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" />
            로그아웃
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            안녕하세요, {profileName || "회원"}님 👋
          </h1>
          <p className="text-sm text-muted-foreground">오늘도 운동 화이팅!</p>
        </div>

        {myDemoMember && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">잔여 세션</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {remain}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  / {myDemoMember.totalSessions} 회
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> 다가오는 일정
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">예정된 일정이 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{s.date}</p>
                      <p className="text-xs text-muted-foreground">{s.time}</p>
                    </div>
                    <Badge variant="secondary">예정</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> 최근 출석 기록
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAttendance.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 출석 기록이 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {recentAttendance.map((s) => (
                  <li key={s.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{s.date}</p>
                      <p className="text-xs text-muted-foreground">{s.time}</p>
                    </div>
                    <Badge variant={s.attended ? "default" : "destructive"}>
                      {s.attended ? "출석" : "결석"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
