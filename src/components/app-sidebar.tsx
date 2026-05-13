import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardCheck,
  Dumbbell,
  LogOut,
  UserCog,
  BarChart3,
  Activity,
  NotebookPen,
  Megaphone,
  CalendarClock,
  MessageCircle,
  UserCheck,
  CalendarCog,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useRole } from "@/hooks/use-role";
import { useMembers } from "@/lib/store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";
import { LowSessionAlert } from "@/components/low-session-alert";
import { toast } from "sonner";

const allItems = [
  { key: "dash", title: "대시보드", url: "/admin", icon: LayoutDashboard, roles: ["admin", "trainer"] },
  { key: "members", title: "회원 관리", url: "/members", icon: Users, roles: ["admin", "trainer"] },
  { key: "trainers", title: "트레이너 관리", url: "/admin/trainers", icon: UserCog, roles: ["admin"] },
  { key: "approvals", title: "가입 승인", url: "/admin/approvals", icon: UserCheck, roles: ["admin"] },
  { key: "calendar", title: "일정 캘린더", url: "/calendar", icon: Calendar, roles: ["admin", "trainer"] },
  { key: "my-schedule", title: "내 스케줄 설정", url: "/admin/my-schedule", icon: CalendarCog, roles: ["trainer", "admin"] },
  { key: "attendance", title: "출석 체크", url: "/attendance", icon: ClipboardCheck, roles: ["admin", "trainer"] },
  { key: "exercises", title: "운동 라이브러리", url: "/admin/exercises", icon: Activity, roles: ["admin", "trainer"] },
  { key: "workouts", title: "운동기록 관리", url: "/admin/workouts", icon: NotebookPen, roles: ["admin", "trainer"] },
  { key: "requests", title: "승인 요청", url: "/admin/requests", icon: CalendarClock, roles: ["admin", "trainer"] },
  { key: "messages", title: "메시지", url: "/admin/messages", icon: MessageCircle, roles: ["admin", "trainer"] },
  { key: "notice", title: "공지 보내기", url: "/admin/notice", icon: Megaphone, roles: ["admin", "trainer"] },
  { key: "stats", title: "통계", url: "/admin/stats", icon: BarChart3, roles: ["admin"] },
] as const;

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { role } = useRole();
  const { trainerId } = useCurrentTrainer();
  const items = allItems.filter((i) => !role || (i.roles as readonly string[]).includes(role));

  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [profileName, setProfileName] = useState("");
  const [allMembers] = useMembers();

  // 사이드바 하단 인사말용 이름 조회
  useEffect(() => {
    if (!user) {
      setProfileName("");
      return;
    }
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfileName(data?.name ?? ""));
  }, [user]);
  const pendingMemberCount = useMemo(
    () => allMembers.filter((m) => m.status === "pending").length,
    [allMembers]
  );

  // pending schedule requests badge
  useEffect(() => {
    if (!user) return;
    const fetchPending = async () => {
      let q = supabase
        .from("schedule_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (role === "trainer") q = q.eq("trainer_user_id", user.id);
      const { count } = await q;
      setPendingCount(count ?? 0);
    };
    fetchPending();
    const ch = supabase
      .channel(`sidebar_requests:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_requests" }, fetchPending)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, role, trainerId]);

  // unread messages badge
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false);
      setUnreadMsgCount(count ?? 0);
    };
    fetchUnread();
    const ch = supabase
      .channel(`sidebar_msg:${user.id}`)
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

  const handleLogout = async () => {
    await signOut();
    toast.success("로그아웃되었습니다");
    window.location.href = "/login";
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">PT Studio</span>
            <span className="text-xs text-muted-foreground">회원 관리</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {role === "trainer" && <LowSessionAlert />}
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const badge =
                  item.key === "requests" && pendingCount > 0
                    ? pendingCount
                    : item.key === "messages" && unreadMsgCount > 0
                    ? unreadMsgCount
                    : item.key === "approvals" && pendingMemberCount > 0
                    ? pendingMemberCount
                    : 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={currentPath === item.url}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {badge > 0 && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                            {badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="flex flex-col gap-2 p-2">
          <div className="px-2">
            <p className="mb-1 truncate text-[13px] font-medium leading-tight">
              안녕하세요, {profileName || user?.email?.split("@")[0] || "회원"}님 👋
            </p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <SidebarMenuButton onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span>로그아웃</span>
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
