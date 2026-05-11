import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, usePublicTrainers } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { ChatPanel } from "@/components/chat-panel";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/member/messages")({
  component: MemberMessages,
  head: () => ({ meta: [{ title: "메시지 | PT Studio" }] }),
});

type Partner = { id: string; name: string; role: "trainer" | "admin" };

function MemberMessages() {
  const { user } = useAuth();
  const [members] = useMembers();
  const [trainers] = usePublicTrainers();
  const [profileName, setProfileName] = useState("");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [active, setActive] = useState<Partner | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfileName(data?.name ?? ""));
  }, [user]);

  const myMember = useMemo(
    () => (profileName ? members.find((m) => m.name === profileName) : undefined),
    [members, profileName]
  );
  const myTrainer = useMemo(
    () => (myMember?.trainerId ? trainers.find((t) => t.id === myMember.trainerId) ?? null : null),
    [myMember, trainers]
  );

  // Load partner ids: trainer (by name) + all admins
  useEffect(() => {
    if (!user) return;
    const run = async () => {
      const list: Partner[] = [];
      if (myTrainer?.name) {
        const { data } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("name", myTrainer.name)
          .maybeSingle();
        if (data) list.push({ id: data.id, name: data.name, role: "trainer" });
      }
      // admins
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (adminRoles && adminRoles.length > 0) {
        const ids = adminRoles.map((r) => r.user_id);
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", ids);
        (adminProfiles ?? []).forEach((p) => {
          if (!list.find((x) => x.id === p.id)) {
            list.push({ id: p.id, name: p.name || "관리자", role: "admin" });
          }
        });
      }
      setPartners(list);
    };
    run();
  }, [user, myTrainer]);

  if (!user) return null;

  if (active) {
    return (
      <div className="-mx-4 -mb-24 -mt-4 flex h-[calc(100dvh-110px)] flex-col">
        <div className="border-b">
          <Button variant="ghost" size="sm" className="m-1" onClick={() => setActive(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> 목록
          </Button>
        </div>
        <ChatPanel
          myUserId={user.id}
          partnerId={active.id}
          partnerName={`${active.name}${active.role === "admin" ? " (관리자)" : ""}`}
          className="flex-1 min-h-0"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold tracking-tight">메시지</h1>
      {partners.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            대화 가능한 상대가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {partners.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setActive(p)}
                className="flex w-full items-center justify-between rounded-lg border bg-background p-3 text-left transition hover:bg-accent"
              >
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.role === "trainer" ? "담당 트레이너" : "관리자"}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
