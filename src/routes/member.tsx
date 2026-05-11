import { createFileRoute, useNavigate, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { seedDemoData } from "@/lib/store";
import { DEV_BYPASS } from "@/lib/dev-mode";
import { Button } from "@/components/ui/button";
import { Bell, Dumbbell, Home, Calendar, Activity, ClipboardList, User } from "lucide-react";

export const Route = createFileRoute("/member")({
  component: MemberLayout,
  head: () => ({ meta: [{ title: "내 PT | PT Studio" }] }),
});

const tabs = [
  { to: "/member/home", label: "홈", icon: Home },
  { to: "/member/booking", label: "예약", icon: Calendar },
  { to: "/member/workout", label: "운동", icon: Activity },
  { to: "/member/records", label: "기록", icon: ClipboardList },
  { to: "/member/profile", label: "내정보", icon: User },
] as const;

function MemberLayout() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    seedDemoData();
  }, []);

  useEffect(() => {
    if (DEV_BYPASS) return;
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (DEV_BYPASS) return;
    if (!roleLoading && role && (role === "admin" || role === "trainer")) {
      navigate({ to: "/admin" });
    }
  }, [role, roleLoading, navigate]);

  if (!DEV_BYPASS && (authLoading || roleLoading || !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col bg-background shadow-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur">
          <Link to="/member/home" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">PT Studio</span>
              <span className="text-[10px] text-muted-foreground">내 PT</span>
            </div>
          </Link>
          <Button variant="ghost" size="icon" aria-label="알림">
            <Bell className="h-5 w-5" />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <Outlet />
        </main>

        <nav className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur">
          <ul className="grid grid-cols-5">
            {tabs.map((t) => {
              const active = currentPath === t.to || (t.to === "/member/home" && currentPath === "/member");
              const Icon = t.icon;
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    className={`flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ${
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
