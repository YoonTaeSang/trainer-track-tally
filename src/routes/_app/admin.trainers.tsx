import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTrainers, useMembers, useSchedules, useTableStatus, refetchAllTables, uid, type Trainer } from "@/lib/store";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { ErrorBoundary } from "@/components/error-boundary";

export const Route = createFileRoute("/_app/admin/trainers")({
  component: TrainersPageWrapper,
  head: () => ({ meta: [{ title: "트레이너 관리 | PT Studio" }] }),
});

function TrainersPageWrapper() {
  return (
    <ErrorBoundary>
      <TrainersPage />
    </ErrorBoundary>
  );
}

const empty: Omit<Trainer, "id"> = { name: "", phone: "", memo: "" };

function TrainersPage() {
  const navigate = useNavigate();
  const { allowed, loading: roleLoading } = useRoleGuard(["admin"]);
  const [trainers, setTrainers] = useTrainers();
  const [members] = useMembers();
  const [schedules] = useSchedules();
  const trainersStatus = useTableStatus("trainers");
  const membersStatus = useTableStatus("members");
  const schedulesStatus = useTableStatus("schedules");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trainer | null>(null);
  const [form, setForm] = useState<Omit<Trainer, "id">>(empty);
  const [search, setSearch] = useState("");

  const monthPrefix = new Date().toISOString().slice(0, 7);

  const stats = useMemo(() => {
    const map = new Map<string, { memberCount: number; monthSessions: number }>();
    for (const t of trainers) map.set(t.id, { memberCount: 0, monthSessions: 0 });
    const memberToTrainer = new Map<string, string | null | undefined>();
    for (const m of members) {
      memberToTrainer.set(m.id, m.trainerId);
      if (m.trainerId && map.has(m.trainerId)) {
        map.get(m.trainerId)!.memberCount += 1;
      }
    }
    for (const s of schedules) {
      if (!s.date.startsWith(monthPrefix)) continue;
      const tid = memberToTrainer.get(s.memberId);
      if (tid && map.has(tid)) map.get(tid)!.monthSessions += 1;
    }
    return map;
  }, [trainers, members, schedules, monthPrefix]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (t: Trainer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(t);
    const { id, ...rest } = t;
    setForm(rest);
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    if (editing) {
      setTrainers((prev) => prev.map((t) => (t.id === editing.id ? { ...editing, ...form } : t)));
      toast.success("트레이너 정보가 수정되었습니다.");
    } else {
      setTrainers((prev) => [...prev, { id: uid(), ...form }]);
      toast.success("트레이너가 등록되었습니다.");
    }
    setOpen(false);
  };

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTrainers((prev) => prev.filter((t) => t.id !== id));
    toast.success("트레이너가 삭제되었습니다.");
  };

  const filtered = trainers.filter(
    (t) => t.name.includes(search) || t.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">트레이너 관리</h1>
          <p className="text-sm text-muted-foreground">트레이너 정보를 등록하고 관리합니다.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> 트레이너 등록
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "트레이너 수정" : "트레이너 등록"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label>이름</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>연락처</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" />
              </div>
              <div className="grid gap-2">
                <Label>메모</Label>
                <Textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
              <Button onClick={save}>저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="이름 또는 연락처로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 max-w-sm"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead>담당 회원</TableHead>
                <TableHead>이번 달 PT</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    등록된 트레이너가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => {
                  const s = stats.get(t.id) ?? { memberCount: 0, monthSessions: 0 };
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => navigate({ to: "/admin/trainers/$trainerId", params: { trainerId: t.id } })}
                    >
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.memberCount}명</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.monthSessions}회</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={(e) => openEdit(t, e)} title="수정">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={(e) => remove(t.id, e)} title="삭제">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="ml-1 inline h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
