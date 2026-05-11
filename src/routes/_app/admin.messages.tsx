import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";
import { useMembers } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { ChatPanel } from "@/components/chat-panel";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_app/admin/messages")({
  component: AdminMessages,
  head: () => ({ meta: [{ title: "메시지 | PT Studio" }] }),
});

type Partner = { id: string; name: string };

function AdminMessages() {
  const { user } = useAuth();
  const { role } = useRole();
  const { trainerId: currentTrainerId } = useCurrentTrainer();
  const [members] = useMembers();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [unreadByPartner, setUnreadByPartner] = useState<Record<string, number>>({});
  const [active, setActive] = useState<Partner | null>(null);

  const myMembers = useMemo(() => {
    if (role === "admin") return members;
    if (role === "trainer" && currentTrainerId)
      return members.filter((m) => m.trainerId === currentTrainerId);
    return [];
  }, [members, role, currentTrainerId]);

  useEffect(() => {
    const run = async () => {
      if (myMembers.length === 0) {
        setPartners([]);
        return;
      }
      const names = myMembers.map((m) => m.name);
      const { data } = await supabase
        .from("profiles")
        .select("id, name")
        .in("name", names);
      setPartners(((data ?? []) as Partner[]).filter((p) => p.id !== user?.id));
    };
    run();
  }, [myMembers, user]);

  // Load unread counts per partner
  useEffect(() => {
    if (!user || partners.length === 0) return;
    const run = async () => {
      const { data } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("recipient_id", user.id)
        .eq("read", false);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((m) => {
        counts[m.sender_id] = (counts[m.sender_id] ?? 0) + 1;
      });
      setUnreadByPartner(counts);
    };
    run();
    const ch = supabase
      .channel(`admin_msg_unread:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        () => run()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, partners]);

  if (!user) return null;

  return (
    <div className="grid h-[calc(100vh-120px)] grid-cols-[300px_1fr] gap-4">
      <Card className="overflow-hidden">
        <div className="border-b px-3 py-2 text-sm font-semibold">대화 목록</div>
        <div className="overflow-y-auto">
          {partners.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              대화 가능한 회원이 없습니다.
            </div>
          ) : (
            <ul>
              {partners.map((p) => {
                const unread = unreadByPartner[p.id] ?? 0;
                const isActive = active?.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => setActive(p)}
                      className={`flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm transition ${
                        isActive ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      <span>{p.name}</span>
                      {unread > 0 && <Badge variant="destructive">{unread}</Badge>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        {active ? (
          <ChatPanel
            myUserId={user.id}
            partnerId={active.id}
            partnerName={active.name}
            className="flex-1 min-h-0"
          />
        ) : (
          <CardContent className="flex flex-1 flex-col items-center justify-center text-sm text-muted-foreground">
            <MessageCircle className="mb-2 h-8 w-8 opacity-50" />
            왼쪽에서 회원을 선택하세요
          </CardContent>
        )}
      </Card>
    </div>
  );
}
