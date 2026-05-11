import { createFileRoute, useNavigate, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { seedDemoData } from "@/lib/store";
import { DEV_BYPASS } from "@/lib/dev-mode";
import { Dumbbell, Home, Calendar, Activity, ClipboardList, User, MessageCircle } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRouteRefresh } from "@/hooks/use-route-refresh";

export const Route = createFileRoute("/member")({
  component: MemberLayout,
  head: () => ({ meta: [{ title: "내 PT | PT Studio" }] }),
});

const tabs = [
  { to: "/member/home", label: "홈", icon: Home },
  { to: "/member/booking", label: "예약", icon: Calendar },
  { to: "/member/exercises", label: "운동", icon: Activity },
  { to: "/member/messages", label: "메시지", icon: MessageCircle },
  { to: "/member/records", label: "기록", icon: ClipboardList },
  { to: "/member/profile", label: "내정보", icon: User },
] as const;

function MemberLayout() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [memberStatus, setMemberStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchStatus = async () => {
      const { data } = await supabase
        .from("members")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      setMemberStatus(data?.status ?? null);
    };
    fetchStatus();
    const ch = supabase
      .channel(`member_status:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members", filter: `user_id=eq.${user.id}` },
        fetchStatus
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  useEffect(() => {
    seedDemoData();
  }, []);
  useRouteRefresh();

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false);
      setUnreadMsg(count ?? 0);
    };
    fetchUnread();
    const ch = supabase
      .channel(`member_msg_unread:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        fetchUnread
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

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

  if (!DEV_BYPASS && memberStatus && memberStatus !== "active") {
    const labels: Record<string, { title: string; desc: string }> = {
      pending: {
        title: "가입 승인 대기중입니다",
        desc: "관리자 승인 후 이용 가능합니다. 관리자에게 문의하세요.",
      },
      inactive: {
        title: "비활성화된 계정입니다",
        desc: "계정이 비활성화되어 있습니다. 관리자에게 문의하세요.",
      },
      rejected: {
        title: "가입이 거절되었습니다",
        desc: "관리자에게 문의하세요.",
      },
    };
    const info = labels[memberStatus] ?? labels.pending;
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold">{info.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{info.desc}</p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login" });
            }}
            className="w-full rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            로그아웃
          </button>
        </div>
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
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <Outlet />
        </main>

        <nav className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur">
          <ul className="grid grid-cols-6">
            {tabs.map((t) => {
              const active = currentPath === t.to || (t.to === "/member/home" && currentPath === "/member");
              const Icon = t.icon;
              const showBadge = t.to === "/member/messages" && unreadMsg > 0;
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ${
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {showBadge && (
                      <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                        {unreadMsg}
                      </span>
                    )}
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
