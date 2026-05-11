import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BODY_PARTS, DIFFICULTIES, difficultyVariant } from "@/lib/exercises";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_app/admin/exercises")({
  component: AdminExercisesPage,
  head: () => ({ meta: [{ title: "운동 라이브러리 | PT Studio" }] }),
});

type Exercise = {
  id: string;
  name: string;
  body_part: string;
  difficulty: string;
  description: string;
  youtube_url: string | null;
  thumbnail_url: string | null;
};

const empty = {
  name: "",
  body_part: BODY_PARTS[0] as string,
  difficulty: DIFFICULTIES[0] as string,
  description: "",
  youtube_url: "",
  thumbnail_url: "",
};

function AdminExercisesPage() {
  const { role } = useRole();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [search, setSearch] = useState("");

  const reload = async () => {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("불러오기 실패: " + error.message);
    setItems((data ?? []) as Exercise[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  };

  const openEdit = (e: Exercise) => {
    setEditing(e);
    setForm({
      name: e.name,
      body_part: e.body_part,
      difficulty: e.difficulty,
      description: e.description ?? "",
      youtube_url: e.youtube_url ?? "",
      thumbnail_url: e.thumbnail_url ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      body_part: form.body_part,
      difficulty: form.difficulty,
      description: form.description,
      youtube_url: form.youtube_url || null,
      thumbnail_url: form.thumbnail_url || null,
    };
    if (editing) {
      const { error } = await supabase.from("exercises").update(payload).eq("id", editing.id);
      if (error) return toast.error("수정 실패: " + error.message);
      toast.success("운동이 수정되었습니다.");
    } else {
      const { error } = await supabase.from("exercises").insert(payload);
      if (error) return toast.error("등록 실패: " + error.message);
      toast.success("운동이 등록되었습니다.");
    }
    setOpen(false);
    reload();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("exercises").delete().eq("id", id);
    if (error) return toast.error("삭제 실패: " + error.message);
    toast.success("운동이 삭제되었습니다.");
    reload();
  };

  const filtered = items.filter(
    (e) => e.name.toLowerCase().includes(search.toLowerCase()) || e.body_part.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">운동 라이브러리</h1>
          <p className="text-sm text-muted-foreground">
            회원에게 제공되는 운동 정보를 관리합니다.
          </p>
        </div>
        {isAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> 운동 등록
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "운동 수정" : "운동 등록"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label>이름</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>부위</Label>
                  <Select
                    value={form.body_part}
                    onValueChange={(v) => setForm({ ...form, body_part: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BODY_PARTS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>난이도</Label>
                  <Select
                    value={form.difficulty}
                    onValueChange={(v) => setForm({ ...form, difficulty: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>YouTube 링크</Label>
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={form.youtube_url}
                  onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>썸네일 이미지 URL (선택)</Label>
                <Input
                  placeholder="https://..."
                  value={form.thumbnail_url}
                  onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>설명 / 자세 / 주의사항</Label>
                <Textarea
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
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
            placeholder="이름 또는 부위로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 max-w-sm"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>부위</TableHead>
                <TableHead>난이도</TableHead>
                <TableHead>YouTube</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    불러오는 중...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    등록된 운동이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{e.body_part}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={difficultyVariant(e.difficulty)}>{e.difficulty}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {e.youtube_url ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)} title="수정">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(e.id)} title="삭제">
                        <Trash2 className="h-4 w-4" />
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
