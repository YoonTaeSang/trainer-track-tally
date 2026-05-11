import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { useSchedules, useMembers } from "@/lib/store";

export const Route = createFileRoute("/_app/admin/requests")({
  component: RequestsPage,
  head: () => ({ meta: [{ title: "승인 요청 | PT Studio" }] }),
});

type Req = {
  id: string;
  member_user_id: string;
  trainer_user_id: string | null;
  member_name: string;
  trainer_name: string | null;
  original_schedule_id: string | null;
  original_date: string;
  original_time: string;
  request_type: "cancel" | "change";
  requested_date: string | null;
  requested_time: string | null;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  created_at: string;
};

function RequestsPage() {
  const { user } = useAuth();
  const { role } = useRole();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [reason, setReason] = useState("");
  const [schedules, setSchedules] = useSchedules();
  const [, setMembers] = useMembers();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("schedule_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Req[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("schedule_requests_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_requests" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const visible =
    role === "admin"
      ? items
      : items.filter((r) => !r.trainer_user_id || r.trainer_user_id === user?.id);
  const pending = visible.filter((r) => r.status === "pending");
  const others = visible.filter((r) => r.status !== "pending");

  // Apply approved request to the local schedule store (best-effort, same browser)
  const applyToLocalSchedule = (req: Req) => {
    if (!req.original_schedule_id) return;
    if (req.request_type === "cancel") {
      const sch = schedules.find((s) => s.id === req.original_schedule_id);
      if (!sch) return;
      setSchedules((prev) => prev.filter((s) => s.id !== req.original_schedule_id));
      // refund session
      setMembers((prev) =>
        prev.map((m) =>
          m.id === sch.memberId ? { ...m, usedSessions: Math.max(0, m.usedSessions - 1) } : m
        )
      );
    } else if (req.request_type === "change" && req.requested_date && req.requested_time) {
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === req.original_schedule_id
            ? { ...s, date: req.requested_date!, time: req.requested_time! }
            : s
        )
      );
    }
  };

  const approve = async (req: Req) => {
    const { error } = await supabase
      .from("schedule_requests")
      .update({ status: "approved" })
      .eq("id", req.id);
    if (error) return toast.error(error.message);
    applyToLocalSchedule(req);
    await supabase.from("notifications").insert({
      user_id: req.member_user_id,
      type: "trainer_message",
      title: req.request_type === "cancel" ? "취소 승인" : "변경 승인",
      body:
        req.request_type === "cancel"
          ? `${req.original_date} ${req.original_time} 일정이 취소되었습니다.`
          : `일정이 ${req.requested_date} ${req.requested_time}로 변경되었습니다.`,
    });
    toast.success("승인되었습니다");
    load();
  };

  const submitReject = async () => {
    if (!rejecting) return;
    if (!reason.trim()) return toast.error("거절 사유를 입력해주세요");
    const { error } = await supabase
      .from("schedule_requests")
      .update({ status: "rejected", reject_reason: reason.trim() })
      .eq("id", rejecting.id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({
      user_id: rejecting.member_user_id,
      type: "trainer_message",
      title: rejecting.request_type === "cancel" ? "취소 거절" : "변경 거절",
      body: `사유: ${reason.trim()}`,
    });
    toast.success("거절되었습니다");
    setRejecting(null);
    setReason("");
    load();
  };

  const renderReq = (r: Req) => (
    <div key={r.id} className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={r.request_type === "cancel" ? "destructive" : "secondary"}>
              {r.request_type === "cancel" ? "취소" : "변경"}
            </Badge>
            <span className="text-sm font-semibold">{r.member_name}</span>
            {r.trainer_name && (
              <span className="text-xs text-muted-foreground">→ {r.trainer_name}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            기존: {r.original_date} {r.original_time}
          </p>
          {r.request_type === "change" && (
            <p className="text-xs text-primary">
              요청: {r.requested_date} {r.requested_time}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {new Date(r.created_at).toLocaleString("ko-KR")}
          </p>
          {r.status === "rejected" && r.reject_reason && (
            <p className="text-xs text-destructive">사유: {r.reject_reason}</p>
          )}
        </div>
        {r.status === "pending" ? (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => approve(r)}>
              <Check className="mr-1 h-3.5 w-3.5" /> 승인
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejecting(r)}>
              <X className="mr-1 h-3.5 w-3.5" /> 거절
            </Button>
          </div>
        ) : (
          <Badge variant={r.status === "approved" ? "default" : "outline"}>
            {r.status === "approved" ? "승인" : "거절"}
          </Badge>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">승인 요청</h1>
        <p className="text-sm text-muted-foreground">
          회원의 PT 일정 취소/변경 신청을 처리합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" /> 대기 중 ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">대기 중인 요청이 없습니다.</p>
          ) : (
            pending.map(renderReq)
          )}
        </CardContent>
      </Card>

      {others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">처리 완료</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">{others.slice(0, 20).map(renderReq)}</CardContent>
        </Card>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>거절 사유</DialogTitle>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            placeholder="회원에게 전달할 사유를 입력해주세요"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              취소
            </Button>
            <Button onClick={submitReject}>거절 보내기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
