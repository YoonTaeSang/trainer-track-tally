import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useMembers } from "@/lib/store";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/admin/notice")({
  component: NoticePage,
  head: () => ({ meta: [{ title: "공지 보내기 | PT Studio" }] }),
});

function NoticePage() {
  const [members] = useMembers();
  const { role } = useRole();
  const { user } = useAuth();
  const { trainerId: currentTrainerId } = useCurrentTrainer();
  const isAdmin = role === "admin";
  const isTrainer = role === "trainer";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const eligible = useMemo(() => {
    const base = isAdmin
      ? members
      : isTrainer && currentTrainerId
        ? members.filter((m) => m.trainerId === currentTrainerId)
        : [];
    return base.filter((m) => m.status === "active");
  }, [members, isAdmin, isTrainer, currentTrainerId]);

  const targets = useMemo(() => {
    if (isAdmin && audience === "selected") {
      return eligible.filter((m) => selectedIds.includes(m.id));
    }
    return eligible;
  }, [eligible, isAdmin, audience, selectedIds]);

  const toggleId = (id: string) =>
    setSelectedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

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
      const targetsWithUser = targets.filter((m) => !!m.userId);
      const category = isAdmin ? "gym" : "trainer";
      const rows = targetsWithUser.map((m) => ({
        user_id: m.userId as string,
        sender_id: user?.id ?? null,
        type: "trainer_message",
        category,
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
      setSelectedIds([]);
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
          {isAdmin
            ? "헬스장 공지로 분류되어 발송됩니다."
            : "담당 회원에게 트레이너 공지로 발송됩니다."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4" /> 공지 작성
              <Badge variant="outline" className="ml-auto text-[10px]">
                {isAdmin ? "헬스장 공지" : "트레이너 공지"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin && (
              <div className="grid gap-2">
                <Label>수신 대상</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={audience === "all" ? "default" : "outline"}
                    onClick={() => setAudience("all")}
                  >
                    전체 회원
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={audience === "selected" ? "default" : "outline"}
                    onClick={() => setAudience("selected")}
                  >
                    특정 회원 선택
                  </Button>
                </div>
              </div>
            )}
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
            <CardTitle className="text-base">
              {isAdmin && audience === "selected" ? "수신자 선택" : "수신 대상"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eligible.length === 0 ? (
              <p className="text-sm text-muted-foreground">발송 대상 회원이 없습니다.</p>
            ) : (
              <ul className="max-h-[420px] space-y-2 overflow-y-auto">
                {eligible.map((m) => {
                  const checked = isAdmin && audience === "selected" ? selectedIds.includes(m.id) : true;
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <div className="flex items-center gap-2">
                        {isAdmin && audience === "selected" && (
                          <Checkbox checked={checked} onCheckedChange={() => toggleId(m.id)} />
                        )}
                        <span>{m.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{m.phone}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
