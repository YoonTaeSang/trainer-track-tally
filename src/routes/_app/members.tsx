import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
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
import { useMembers, uid, type Member } from "@/lib/store";

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
};

function MembersPage() {
  const [members, setMembers] = useMembers();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<Omit<Member, "id">>(empty);
  const [search, setSearch] = useState("");

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

  const filtered = members.filter(
    (m) => m.name.includes(search) || m.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">회원 관리</h1>
          <p className="text-sm text-muted-foreground">회원 정보를 등록하고 관리합니다.</p>
        </div>
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
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    등록된 회원이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const remain = m.totalSessions - m.usedSessions;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.phone}</TableCell>
                      <TableCell>{m.joinedAt}</TableCell>
                      <TableCell>{m.usedSessions} / {m.totalSessions}</TableCell>
                      <TableCell>
                        <Badge variant={remain <= 2 ? "destructive" : remain <= 5 ? "secondary" : "outline"}>
                          {remain}회
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
