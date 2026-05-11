import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useRole, type AppRole } from "@/hooks/use-role";

/**
 * Redirects user away from the page if their role is not in `allowed`.
 * Returns { role, loading, allowed } so the page can render a loading state.
 */
export function useRoleGuard(allowed: AppRole[], redirectTo = "/admin") {
  const { role, loading } = useRole();
  const navigate = useNavigate();
  const isAllowed = role ? allowed.includes(role) : false;

  useEffect(() => {
    if (loading) return;
    if (!role) return;
    if (!isAllowed) {
      navigate({ to: redirectTo });
    }
  }, [loading, role, isAllowed, navigate, redirectTo]);

  return { role, loading, allowed: isAllowed };
}
