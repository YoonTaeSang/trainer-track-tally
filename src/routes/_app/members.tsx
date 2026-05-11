import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Pencil, CalendarPlus, BatteryCharging, UserX, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
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
import { useMembers, useSchedules, useTrainers, uid, type Member } from "@/lib/store";
import { useRole } from "@/hooks/use-role";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/members")({
  component: MembersPage,
  head: () => ({ meta: [{ title: "회원 관리 | PT Studio" }] }),
});

const empty: Omit<Member, "id"> = {
  name: "",
  phone: "",
  joinedAt: new Date().toISOString().slice(0, 10),
  totalSessions: 0,
  usedSessions: 0,
  memo: "",
  status: "active",
};

function MembersPage() {
  const [members, setMembers] = useMembers();
  const [, setSchedules] = useSchedules();
  const [trainers] = useTrainers();
  const { role } = useRole();
  const { trainerId: currentTrainerId } = useCurrentTrainer();
  const isAdmin = role === "admin";
  const isTrainer = role === "trainer";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<Omit<Member, "id">>(empty);
  const [search, setSearch] = useState("");
  const [scheduleFor, setScheduleFor] = useState<Member | null>(null);
  const [schedDate, setSchedDate] = useState(new Date().toISOString().slice(0, 10));
  const [schedTime, setSchedTime] = useState("10:00");
  const [chargeFor, setChargeFor] = useState<Member | null>(null);
  const [chargeAmount, setChargeAmount] = useState(10);

  const assignTrainer = (memberId: string, trainerId: string) => {
    const tid = trainerId === "__none__" ? null : trainerId;
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, trainerId: tid } : m)));
    toast.success("담당 트레이너가 저장되었습니다.");
  };

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

  const openSchedule = (m: Member) => {
    setScheduleFor(m);
    setSchedDate(new Date().toISOString().slice(0, 10));
    setSchedTime("10:00");
  };

  const addSchedule = () => {
    if (!scheduleFor) return;
    if (!schedDate || !schedTime) {
      toast.error("날짜와 시간을 입력해주세요.");
      return;
    }
    setSchedules((prev) => [
      ...prev,
      { id: uid(), memberId: scheduleFor.id, date: schedDate, time: schedTime, attended: null },
    ]);
    toast.success(`${scheduleFor.name} 회원의 일정이 추가되었습니다.`);
    setScheduleFor(null);
  };

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (m: Member) => {
    setEditing(m);
    const { id, ...rest } = m;
    setForm(rest);
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    if (editing) {
      setMembers((prev) => prev.map((m) => (m.id === editing.id ? { ...editing, ...form } : m)));
      toast.success("회원 정보가 수정되었습니다.");
    } else {
      setMembers((prev) => [...prev, { id: uid(), ...form }]);
      toast.success("회원이 등록되었습니다.");
    }
    setOpen(false);
  };

  const remove = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    toast.success("회원이 삭제되었습니다.");
  };

  const filtered = members
    .filter((m) => (isTrainer && currentTrainerId ? m.trainerId === currentTrainerId : true))
    .filter((m) => m.name.includes(search) || m.phone.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">회원 관리</h1>
          <p className="text-sm text-muted-foreground">회원 정보를 등록하고 관리합니다.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> 회원 등록
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "회원 수정" : "회원 등록"}</DialogTitle>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>등록일</Label>
                  <Input type="date" value={form.joinedAt} onChange={(e) => setForm({ ...form, joinedAt: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>총 세션</Label>
                  <Input type="number" min={0} value={form.totalSessions} onChange={(e) => setForm({ ...form, totalSessions: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>사용 세션</Label>
                <Input type="number" min={0} value={form.usedSessions} onChange={(e) => setForm({ ...form, usedSessions: Number(e.target.value) })} />
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
        )}
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
                <TableHead>등록일</TableHead>
                <TableHead>세션</TableHead>
                <TableHead>잔여</TableHead>
                {isAdmin && <TableHead>담당 트레이너</TableHead>}
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-sm text-muted-foreground">
                    등록된 회원이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const remain = m.totalSessions - m.usedSessions;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/members/$memberId"
                          params={{ memberId: m.id }}
                          className="hover:underline"
                        >
                          {m.name}
                        </Link>
                      </TableCell>
                      <TableCell>{m.phone}</TableCell>
                      <TableCell>{m.joinedAt}</TableCell>
                      <TableCell>{m.usedSessions} / {m.totalSessions}</TableCell>
                      <TableCell>
                        <Badge variant={remain <= 2 ? "destructive" : remain <= 5 ? "secondary" : "outline"}>
                          {remain}회
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Select
                            value={m.trainerId ?? "__none__"}
                            onValueChange={(v) => assignTrainer(m.id, v)}
                          >
                            <SelectTrigger className="h-8 w-[160px]">
                              <SelectValue placeholder="미배정" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">미배정</SelectItem>
                              {trainers.map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => openCharge(m)} title="세션 충전">
                            <BatteryCharging className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => openSchedule(m)} title="일정 추가">
                          <CalendarPlus className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => openEdit(m)} title="수정">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => remove(m.id)} title="삭제">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!scheduleFor} onOpenChange={(v) => !v && setScheduleFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>일정 추가 — {scheduleFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>날짜</Label>
              <Input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>시간</Label>
              <Input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleFor(null)}>취소</Button>
            <Button onClick={addSchedule}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
