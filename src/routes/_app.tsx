import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { seedDemoData, refetchAllTables } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { DEV_BYPASS } from "@/lib/dev-mode";
import { useRouteRefresh } from "@/hooks/use-route-refresh";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    seedDemoData();
  }, []);
  useRouteRefresh();

  // Realtime RLS 이슈 보완: 탭이 다시 활성화될 때 전체 refetch
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refetchAllTables();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (DEV_BYPASS) return;
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  // Members shouldn't access admin pages
  useEffect(() => {
    if (DEV_BYPASS) return;
    if (!roleLoading && role === "member") {
      navigate({ to: "/member" });
    }
  }, [role, roleLoading, navigate]);

  if (!DEV_BYPASS && (loading || roleLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  if (!DEV_BYPASS && !session) return null;
  if (!DEV_BYPASS && role === "member") return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <h1 className="text-sm font-medium text-muted-foreground">PT 회원 관리 시스템</h1>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}
