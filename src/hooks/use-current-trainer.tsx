import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTrainers } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve current trainer record (in local store) by matching
 * the auth profile.name against trainers.name.
 * Returns null while loading or if no match.
 */
export function useCurrentTrainer() {
  const { user } = useAuth();
  const [trainers] = useTrainers();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
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

  const trainer = profileName
    ? trainers.find((t) => t.name === profileName || t.name.startsWith(profileName)) ?? null
    : null;

  return { trainer, trainerId: trainer?.id ?? null, profileName, loaded };
}
