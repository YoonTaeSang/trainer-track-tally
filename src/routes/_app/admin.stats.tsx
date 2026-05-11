import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BatteryCharging, Users as UsersIcon, UserPlus, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useMembers, useSchedules, type Member } from "@/lib/store";
import { useRoleGuard } from "@/hooks/use-role-guard";

export const Route = createFileRoute("/_app/admin/stats")({
  component: StatsPage,
  head: () => ({ meta: [{ title: "통계 | PT Studio" }] }),
});

function StatsPage() {
  const { allowed } = useRoleGuard(["admin"]);
  const [members, setMembers] = useMembers();
  const [schedules] = useSchedules();
  const [chargeFor, setChargeFor] = useState<Member | null>(null);
  const [chargeAmount, setChargeAmount] = useState(10);

  if (!allowed) return null;

  const today = new Date();

  // 최근 6개월 출석률
  const monthlyAttendance = useMemo(() => {
    const months: { key: string; label: string; year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${d.getMonth() + 1}월`,
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    return months.map((m) => {
      const inMonth = schedules.filter((s) => {
        const [y, mo] = s.date.split("-").map(Number);
        return y === m.year && mo === m.month + 1 && s.attended !== null;
      });
      const attended = inMonth.filter((s) => s.attended === true).length;
      const total = inMonth.length;
      const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
      return { month: m.label, 출석률: rate, 출석: attended, 전체: total };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules]);

  // 회원 현황
  const totalMembers = members.length;
  const thisMonthNew = useMemo(() => {
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    return members.filter((mb) => {
      const [yy, mm] = mb.joinedAt.split("-").map(Number);
      return yy === y && mm === m;
    }).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  const lowSession = useMemo(
    () =>
      members
        .map((m) => ({ ...m, remain: m.totalSessions - m.usedSessions }))
        .filter((m) => m.remain <= 3)
        .sort((a, b) => a.remain - b.remain),
    [members]
  );

  const openCharge = (m: Member) => {
    setChargeFor(m);
    setChargeAmount(10);
  };

  const applyCharge = () => {
    if (!chargeFor) return;
    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
      toast.error("1회 이상의 충전 횟수를 입력해주세요.");
      return;
    }
    setMembers((prev) =>
      prev.map((m) =>
        m.id === chargeFor.id ? { ...m, totalSessions: m.totalSessions + chargeAmount } : m
      )
    );
    toast.success(`${chargeFor.name} 회원에게 ${chargeAmount}회 충전되었습니다.`);
    setChargeFor(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">통계</h1>
        <p className="text-sm text-muted-foreground">회원 현황과 출석률을 한눈에 확인합니다.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">전체 회원</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalMembers}<span className="ml-1 text-base font-normal text-muted-foreground">명</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">이번 달 신규</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{thisMonthNew}<span className="ml-1 text-base font-normal text-muted-foreground">명</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">세션 만료 임박</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{lowSession.length}<span className="ml-1 text-base font-normal text-muted-foreground">명</span></div>
            <p className="mt-1 text-xs text-muted-foreground">잔여 3회 이하</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">월별 출석률 (최근 6개월)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyAttendance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name) =>
                    name === "출석률" ? [`${value}%`, "출석률"] : [value, name]
                  }
                />
                <Bar dataKey="출석률" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">잔여 세션 부족 회원</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>잔여 횟수</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowSession.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    잔여 세션이 부족한 회원이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                lowSession.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>
                      <Badge variant={m.remain <= 1 ? "destructive" : "secondary"}>
                        {m.remain}회
                      </Badge>
                    </TableCell>
                    <TableCell>{m.phone}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openCharge(m)}>
                        <BatteryCharging className="mr-1 h-4 w-4" />
                        세션 충전
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!chargeFor} onOpenChange={(v) => !v && setChargeFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>세션 충전 — {chargeFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              현재 잔여: {chargeFor ? chargeFor.totalSessions - chargeFor.usedSessions : 0}회
              {" / "}총 {chargeFor?.totalSessions ?? 0}회
            </p>
            <div className="grid gap-2">
              <Label>충전 횟수</Label>
              <Input
                type="number"
                min={1}
                value={chargeAmount}
                onChange={(e) => setChargeAmount(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 20, 30].map((n) => (
                <Button key={n} type="button" size="sm" variant="outline" onClick={() => setChargeAmount(n)}>
                  +{n}회
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeFor(null)}>취소</Button>
            <Button onClick={applyCharge}>충전</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
