import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { usePublicTrainers, useTableStatus, refetchAllTables } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { DEV_BYPASS, getDevRole, onDevRoleChange } from "@/lib/dev-mode";

// Module-level guard so multiple components that call useCurrentTrainer
// at the same time don't race to insert duplicate trainer rows.
let linkingUserId: string | null = null;

/**
 * Resolve current trainer record (in local store) by matching
 * the auth user.id (preferred) or profile.name (fallback) against trainers.
 * If the logged-in user has the admin/trainer role but no matching trainer
 * row exists, this hook auto-links an existing same-name trainer or
 * creates a new trainer row linked to the user.
 * In DEV_BYPASS trainer mode, returns the first trainer in the store.
 */
export function useCurrentTrainer() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [trainers] = usePublicTrainers();
  const trainersStatus = useTableStatus("trainers_public");
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

  // Auto-link/create trainer row for admin or trainer accounts that have no
  // matching trainer entry yet. This avoids the "트레이너 계정 연결 후 사용 가능합니다"
  // dead-end on pages like /admin/my-schedule.
  useEffect(() => {
    if (DEV_BYPASS) return;
    if (!loaded || !user) return;
    if (!trainersStatus.loaded) return;
    if (roleLoading) return;
    if (role !== "admin" && role !== "trainer") return;

    const byUserId = trainers.find((t) => t.userId === user.id);
    if (byUserId) {
      if (linkingUserId === user.id) linkingUserId = null;
      return;
    }
    if (linkingUserId === user.id) return;
    linkingUserId = user.id;

    (async () => {
      // 1) Try to link an existing trainer with matching name and no user_id yet.
      if (profileName) {
        const byName = trainers.find(
          (t) =>
            (t.name === profileName || t.name.startsWith(profileName)) && !t.userId
        );
        if (byName) {
          const { error } = await supabase
            .from("trainers")
            .update({ user_id: user.id })
            .eq("id", byName.id);
          if (!error) {
            refetchAllTables();
            return;
          }
          console.error("[useCurrentTrainer] link error", error);
        }
      }
      // 2) Otherwise create a new trainer row linked to this user.
      const { error } = await supabase.from("trainers").insert({
        user_id: user.id,
        name: profileName || "내 트레이너",
        phone: "",
      });
      if (error) {
        console.error("[useCurrentTrainer] insert error", error);
        linkingUserId = null;
        return;
      }
      refetchAllTables();
    })();
  }, [loaded, user, trainers, profileName, trainersStatus.loaded, role, roleLoading]);

  let trainer = trainers.find((t) => t.userId === user?.id)
    ?? (profileName
      ? trainers.find((t) => t.name === profileName || t.name.startsWith(profileName ?? "")) ?? null
      : null);

  if (DEV_BYPASS && devRole === "trainer" && !trainer) {
    trainer = trainers[0] ?? null;
  }

  return { trainer, trainerId: trainer?.id ?? null, profileName, loaded };
}
