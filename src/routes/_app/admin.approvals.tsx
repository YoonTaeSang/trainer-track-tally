import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserCheck, UserX } from "lucide-react";
import { useMembers } from "@/lib/store";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/approvals")({
  component: ApprovalsPage,
  head: () => ({ meta: [{ title: "가입 승인 | PT Studio" }] }),
});

function ApprovalsPage() {
  const { allowed } = useRoleGuard(["admin"]);
  const [members, setMembers] = useMembers();
  const [emails, setEmails] = useState<Record<string, string>>({});

  const pending = useMemo(
    () => members.filter((m) => m.status === "pending"),
    [members]
  );

  // Fetch emails for each pending member's user_id (best-effort)
  useEffect(() => {
    const ids = pending
      .map((m) => (m as any).trainerId == null ? m : m)
      .map((m: any) => m.user_id ?? null)
      .filter(Boolean);
    if (ids.length === 0) return;
    // user_id isn't on local Member; query members directly
    supabase
      .from("members")
      .select("id, user_id")
      .in("id", pending.map((m) => m.id))
      .then(async ({ data }) => {
        if (!data) return;
        const userIds = data.map((d) => d.user_id).filter(Boolean) as string[];
        if (userIds.length === 0) return;
        // profiles doesn't have email, but auth doesn't expose it via RLS.
        // We approximate: show user_id short tag.
        const map: Record<string, string> = {};
        data.forEach((d) => {
          const m = pending.find((p) => p.id === d.id);
          if (m && d.user_id) map[m.id] = d.user_id.slice(0, 8) + "…";
        });
        setEmails(map);
      });
  }, [pending]);

  if (!allowed) return null;

  const approve = (id: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "active" } : m))
    );
    toast.success("회원이 승인되었습니다.");
  };

  const reject = (id: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "rejected" } : m))
    );
    toast.success("가입이 거절되었습니다.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">가입 승인</h1>
        <p className="text-sm text-muted-foreground">
          신규 회원의 가입 요청을 승인하거나 거절합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            승인 대기중{" "}
            <Badge variant={pending.length > 0 ? "destructive" : "outline"}>
              {pending.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>식별자</TableHead>
                <TableHead>가입일</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    승인 대기중인 회원이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {emails[m.id] ?? "—"}
                    </TableCell>
                    <TableCell>{m.joinedAt}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" onClick={() => approve(m.id)}>
                        <UserCheck className="mr-1 h-3.5 w-3.5" /> 승인
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reject(m.id)}>
                        <UserX className="mr-1 h-3.5 w-3.5" /> 거절
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
