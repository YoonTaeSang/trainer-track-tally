import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Calendar, ClipboardCheck, Dumbbell, LogOut, UserCog, BarChart3, Activity, NotebookPen } from "lucide-react";
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
import { toast } from "sonner";

const items = [
  { title: "대시보드", url: "/admin", icon: LayoutDashboard },
  { title: "회원 관리", url: "/members", icon: Users },
  { title: "트레이너 관리", url: "/admin/trainers", icon: UserCog },
  { title: "일정 캘린더", url: "/calendar", icon: Calendar },
  { title: "출석 체크", url: "/attendance", icon: ClipboardCheck },
  { title: "운동 라이브러리", url: "/admin/exercises", icon: Activity },
  { title: "운동기록 관리", url: "/admin/workouts", icon: NotebookPen },
  { title: "통계", url: "/admin/stats", icon: BarChart3 },
] as const;

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    toast.success("로그아웃되었습니다");
    navigate({ to: "/login" });
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
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="flex flex-col gap-2 p-2">
          <span className="truncate px-2 text-xs text-muted-foreground">{user?.email}</span>
          <SidebarMenuButton onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span>로그아웃</span>
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
