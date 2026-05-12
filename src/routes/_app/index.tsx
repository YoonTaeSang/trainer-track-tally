import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_app/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  const { role, loading } = useRole();

  useEffect(() => {
    if (loading) return;
    if (role === "admin") {
      navigate({ to: "/admin", replace: true });
    } else if (role === "trainer") {
      navigate({ to: "/admin/trainers", replace: true });
    } else if (role === "member") {
      navigate({ to: "/member", replace: true });
    } else {
      navigate({ to: "/login", replace: true });
    }
  }, [role, loading, navigate]);

  return (
    <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
      이동 중...
    </div>
  );
}
