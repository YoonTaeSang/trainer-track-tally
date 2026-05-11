import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMembers } from "@/lib/store";
import { useRole } from "@/hooks/use-role";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/admin/notice")({
  component: NoticePage,
  head: () => ({ meta: [{ title: "공지 보내기 | PT Studio" }] }),
});

function NoticePage() {
  const [members] = useMembers();
  const { role } = useRole();
  const { trainerId: currentTrainerId } = useCurrentTrainer();
  const isAdmin = role === "admin";
  const isTrainer = role === "trainer";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const targets = useMemo(() => {
    if (isAdmin) return members;
    if (isTrainer && currentTrainerId) return members.filter((m) => m.trainerId === currentTrainerId);
    return [];
  }, [members, isAdmin, isTrainer, currentTrainerId]);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("제목과 내용을 입력해주세요.");
      return;
    }
    if (targets.length === 0) {
      toast.error("발송 대상 회원이 없습니다.");
      return;
    }
    setSending(true);
    try {
      // Match member names to auth user_ids via profiles table
      const names = targets.map((m) => m.name);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, name")
        .in("name", names);
      if (pErr) throw pErr;

      const rows = (profiles ?? []).map((p) => ({
        user_id: p.id,
        type: "trainer_message",
        title: title.trim(),
        body: body.trim(),
      }));

      if (rows.length === 0) {
        toast.warning("연결된 회원 계정을 찾을 수 없습니다.");
        return;
      }

      const { error } = await supabase.from("notifications").insert(rows);
      if (error) throw error;

      toast.success(`${rows.length}명에게 공지가 발송되었습니다.`);
      setTitle("");
      setBody("");
    } catch (e) {
      console.error(e);
      toast.error("공지 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">공지 보내기</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "전체 회원에게 공지를 발송합니다." : "담당 회원에게 공지를 발송합니다."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4" /> 공지 작성
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>제목</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 휴무 안내" />
            </div>
            <div className="grid gap-2">
              <Label>내용</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="공지 내용을 입력하세요"
                className="min-h-[160px]"
              />
            </div>
            <Button onClick={send} disabled={sending}>
              <Send className="mr-2 h-4 w-4" />
              {sending ? "발송 중..." : `발송 (${targets.length}명)`}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">수신 대상</CardTitle>
          </CardHeader>
          <CardContent>
            {targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">발송 대상 회원이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {targets.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>{m.name}</span>
                    <Badge variant="outline" className="text-[10px]">{m.phone}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
