import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCheck, UserX, Loader2, AlertCircle } from "lucide-react";
import { useMembers, useTableStatus, refetchAllTables } from "@/lib/store";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/approvals")({
  component: ApprovalsPage,
  head: () => ({ meta: [{ title: "가입 승인 | PT Studio" }] }),
});

type AssignRole = "member" | "trainer";

function ApprovalsPage() {
  const { allowed, loading: roleLoading } = useRoleGuard(["admin"]);
  const [members, setMembers] = useMembers();
  const status = useTableStatus("members");
  const [roleSelections, setRoleSelections] = useState<Record<string, AssignRole>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = useMemo(
    () => members.filter((m) => m.status === "pending"),
    [members]
  );

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 권한 확인 중...
      </div>
    );
  }
  if (!allowed) return null;

  const approve = async (id: string) => {
    const member = pending.find((m) => m.id === id);
    if (!member) return;
    if (!member.userId) {
      toast.error("이 회원은 사용자 계정과 연결되어 있지 않아 권한을 부여할 수 없습니다.");
      return;
    }
    const role: AssignRole = roleSelections[id] ?? "member";
    setBusyId(id);
    try {
      // Replace any existing role(s) with the selected one.
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", member.userId);
      if (delErr) throw delErr;

      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: member.userId, role });
      if (insErr) throw insErr;

      // If trainer, ensure a trainers row exists for this user.
      if (role === "trainer") {
        const { data: existing } = await supabase
          .from("trainers")
          .select("id")
          .eq("user_id", member.userId)
          .maybeSingle();
        if (!existing) {
          await supabase.from("trainers").insert({
            user_id: member.userId,
            name: member.name,
            phone: member.phone,
          });
        }
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "active" } : m))
      );
      refetchAllTables();
      toast.success(
        role === "trainer" ? "트레이너로 승인되었습니다." : "회원으로 승인되었습니다."
      );
    } catch (e: any) {
      console.error("[approvals] approve error", e);
      toast.error(`승인 실패: ${e?.message ?? "알 수 없는 오류"}`);
    } finally {
      setBusyId(null);
    }
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

      {status.error ? (
        <Card>
          <CardContent className="flex items-start gap-3 py-6 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <p className="font-medium text-destructive">회원 목록을 불러오지 못했습니다.</p>
              <p className="mt-1 text-muted-foreground">{status.error.message}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => refetchAllTables()}>
                다시 시도
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
          {status.loading && !status.loaded ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead>권한</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      승인 대기중인 회원이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  pending.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.phone || "—"}
                      </TableCell>
                      <TableCell>{m.joinedAt}</TableCell>
                      <TableCell>
                        <Select
                          value={roleSelections[m.id] ?? "member"}
                          onValueChange={(v) =>
                            setRoleSelections((s) => ({ ...s, [m.id]: v as AssignRole }))
                          }
                        >
                          <SelectTrigger className="h-8 w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">회원</SelectItem>
                            <SelectItem value="trainer">트레이너</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button size="sm" onClick={() => approve(m.id)} disabled={busyId === m.id}>
                          {busyId === m.id ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserCheck className="mr-1 h-3.5 w-3.5" />
                          )}
                          승인
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reject(m.id)} disabled={busyId === m.id}>
                          <UserX className="mr-1 h-3.5 w-3.5" /> 거절
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
