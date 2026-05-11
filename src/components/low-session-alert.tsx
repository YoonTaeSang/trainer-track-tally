import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BatteryWarning, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMembers } from "@/lib/store";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function LowSessionAlert() {
  const [members] = useMembers();
  const { trainerId, profileName } = useCurrentTrainer();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const lowMembers = useMemo(
    () =>
      members
        .filter((m) => m.trainerId === trainerId)
        .map((m) => ({ ...m, remain: m.totalSessions - m.usedSessions }))
        .filter((m) => m.remain <= 3)
        .sort((a, b) => a.remain - b.remain),
    [members, trainerId]
  );

  // Persist requested-set per session
  useEffect(() => {
    try {
      const v = sessionStorage.getItem("charge-requested");
      if (v) setRequested(new Set(JSON.parse(v)));
    } catch {}
  }, []);

  const markRequested = (id: string) => {
    setRequested((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        sessionStorage.setItem("charge-requested", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const requestCharge = async (m: (typeof lowMembers)[number]) => {
    if (!user) return;
    setSending(m.id);
    const { data: admins, error: aErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (aErr || !admins || admins.length === 0) {
      toast.error("관리자를 찾을 수 없습니다.");
      setSending(null);
      return;
    }
    const trainerName = profileName || "트레이너";
    const rows = admins.map((a) => ({
      user_id: a.user_id,
      type: "charge_request",
      title: "세션 충전 요청",
      body: `${trainerName} → ${m.name} 회원 잔여 ${m.remain}회 (${m.phone || "연락처 없음"})`,
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    setSending(null);
    if (error) {
      console.error(error);
      toast.error("요청 발송에 실패했습니다.");
      return;
    }
    markRequested(m.id);
    toast.success(`${m.name} 회원 충전 요청을 관리자에게 보냈습니다.`);
  };

  if (!trainerId || lowMembers.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-2 mb-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/15"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1 font-medium group-data-[collapsible=icon]:hidden">
          세션 부족 회원 {lowMembers.length}명
        </span>
        <Badge variant="destructive" className="h-5 px-1.5 text-[10px] group-data-[collapsible=icon]:hidden">
          !
        </Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BatteryWarning className="h-5 w-5 text-destructive" />
              세션 부족 회원 ({lowMembers.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {lowMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.phone || "연락처 없음"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.remain <= 1 ? "destructive" : "secondary"}>
                    잔여 {m.remain}회
                  </Badge>
                  <Button
                    size="sm"
                    variant={requested.has(m.id) ? "outline" : "default"}
                    disabled={sending === m.id || requested.has(m.id)}
                    onClick={() => requestCharge(m)}
                  >
                    <Send className="mr-1 h-3.5 w-3.5" />
                    {requested.has(m.id) ? "요청됨" : sending === m.id ? "발송 중…" : "충전 요청"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
