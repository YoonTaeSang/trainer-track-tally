import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTrainers } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { DEV_BYPASS, getDevRole, onDevRoleChange } from "@/lib/dev-mode";

/**
 * Resolve current trainer record (in local store) by matching
 * the auth profile.name against trainers.name.
 * In DEV_BYPASS trainer mode, returns the first trainer in the store.
 */
export function useCurrentTrainer() {
  const { user } = useAuth();
  const [trainers] = useTrainers();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [devRole, setDevRoleState] = useState(DEV_BYPASS ? getDevRole() : null);

  useEffect(() => {
    if (!DEV_BYPASS) return;
    setDevRoleState(getDevRole());
    return onDevRoleChange((r) => setDevRoleState(r));
  }, []);

  useEffect(() => {
    if (DEV_BYPASS) {
      setLoaded(true);
      return;
    }
    if (!user) {
      setProfileName(null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setProfileName(data?.name ?? "");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

let trainer = trainers.find((t) => t.userId === user?.id)
    ?? (profileName
      ? trainers.find((t) => t.name === profileName || t.name.startsWith(profileName ?? "")) ?? null
      : null);

  if (DEV_BYPASS && devRole === "trainer" && !trainer) {
    trainer = trainers[0] ?? null;
  }

  return { trainer, trainerId: trainer?.id ?? null, profileName, loaded };
}
