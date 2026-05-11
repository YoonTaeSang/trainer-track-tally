import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DEV_BYPASS, getDevRole, onDevRoleChange } from "@/lib/dev-mode";

export type AppRole = "admin" | "trainer" | "member";

export function useRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(DEV_BYPASS ? getDevRole() : null);
  const [loading, setLoading] = useState(!DEV_BYPASS);

  useEffect(() => {
    if (!DEV_BYPASS) return;
    setRole(getDevRole());
    setLoading(false);
    return onDevRoleChange((r) => setRole(r));
  }, []);

  useEffect(() => {
    if (DEV_BYPASS) return;
    if (authLoading) return;
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const roles = (data ?? []).map((r) => r.role as AppRole);
        const resolved: AppRole | null = roles.includes("admin")
          ? "admin"
          : roles.includes("trainer")
          ? "trainer"
          : roles.includes("member")
          ? "member"
          : null;
        setRole(resolved);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { role, loading: DEV_BYPASS ? false : loading || authLoading };
}
