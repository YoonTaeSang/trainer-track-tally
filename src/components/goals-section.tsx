import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Target, TrendingUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Goal = {
  id: string;
  user_id: string;
  goal_type: "weight_loss" | "muscle_gain" | "endurance" | "other";
  title: string;
  unit: string;
  start_value: number | null;
  current_value: number | null;
  target_value: number | null;
  start_date: string;
  target_date: string | null;
  trainer_comment: string | null;
};

const TYPE_LABEL = {
  weight_loss: "체중 감량",
  muscle_gain: "근육 증가",
  endurance: "체력 향상",
  other: "기타",
} as const;

const TYPE_DEFAULT_UNIT: Record<Goal["goal_type"], string> = {
  weight_loss: "kg",
  muscle_gain: "kg",
  endurance: "분",
  other: "",
};

export function computeProgress(g: Goal): number {
  if (g.start_value == null || g.current_value == null || g.target_value == null) return 0;
  const total = g.target_value - g.start_value;
  if (total === 0) return 100;
  const done = g.current_value - g.start_value;
  const pct = (done / total) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

type Props = {
  /** Goals owned by this user_id */
  userId: string;
  /** When true, render read-only with optional trainer comment editor */
  readOnly?: boolean;
  /** When set, shows a trainer comment editor (admin/trainer view) */
  canComment?: boolean;
};

export function GoalsSection({ userId, readOnly = false, canComment = false }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [updating, setUpdating] = useState<Goal | null>(null);
  const [newValue, setNewValue] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  // form state for new goal
  const [fType, setFType] = useState<Goal["goal_type"]>("weight_loss");
  const [fTitle, setFTitle] = useState("");
  const [fStart, setFStart] = useState("");
  const [fTarget, setFTarget] = useState("");
  const [fUnit, setFUnit] = useState("kg");
  const [fTargetDate, setFTargetDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setGoals((data ?? []) as Goal[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitNew = async () => {
    const startN = fStart ? Number(fStart) : null;
    const targetN = fTarget ? Number(fTarget) : null;
    if (!fTitle.trim()) return toast.error("목표 제목을 입력해주세요");
    const { error } = await supabase.from("goals").insert({
      user_id: userId,
      goal_type: fType,
      title: fTitle.trim().slice(0, 100),
      unit: fUnit.slice(0, 20),
      start_value: startN,
      current_value: startN,
      target_value: targetN,
      target_date: fTargetDate || null,
    });
    if (error) return toast.error(error.message);
    toast.success("목표가 추가되었습니다");
    setOpenNew(false);
    setFTitle("");
    setFStart("");
    setFTarget("");
    setFTargetDate("");
    load();
  };

  const submitProgress = async () => {
    if (!updating) return;
    const v = Number(newValue);
    if (!newValue || isNaN(v)) return toast.error("수치를 입력해주세요");
    const { error: e1 } = await supabase.from("goal_progress").insert({
      goal_id: updating.id,
      user_id: userId,
      value: v,
      memo: newMemo.slice(0, 200),
    });
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase
      .from("goals")
      .update({ current_value: v })
      .eq("id", updating.id);
    if (e2) return toast.error(e2.message);
    toast.success("진행률이 업데이트되었습니다");
    setUpdating(null);
    setNewValue("");
    setNewMemo("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("정말 삭제할까요?")) return;
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const saveComment = async (g: Goal) => {
    const v = (commentDraft[g.id] ?? g.trainer_comment ?? "").slice(0, 500);
    const { error } = await supabase
      .from("goals")
      .update({ trainer_comment: v })
      .eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("코멘트가 저장되었습니다");
    load();
  };

  const sortedGoals = useMemo(() => goals, [goals]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Target className="h-4 w-4" /> 내 목표
          </CardTitle>
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={() => setOpenNew(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> 새 목표
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">불러오는 중...</p>
        ) : sortedGoals.length === 0 ? (
          <p className="text-xs text-muted-foreground">설정된 목표가 없습니다.</p>
        ) : (
          sortedGoals.map((g) => {
            const pct = computeProgress(g);
            return (
              <div key={g.id} className="space-y-2 rounded-lg border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {TYPE_LABEL[g.goal_type]}
                      </Badge>
                      <p className="text-sm font-semibold">{g.title}</p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {g.start_date}
                      {g.target_date ? ` ~ ${g.target_date}` : ""}
                    </p>
                  </div>
                  {!readOnly && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => remove(g.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Progress value={pct} className="h-2" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    시작 {g.start_value ?? "-"}
                    {g.unit} · 현재{" "}
                    <span className="font-semibold text-foreground">
                      {g.current_value ?? "-"}
                      {g.unit}
                    </span>{" "}
                    · 목표 {g.target_value ?? "-"}
                    {g.unit}
                  </span>
                  <span className="font-semibold text-primary">{pct}%</span>
                </div>
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setUpdating(g);
                      setNewValue(g.current_value != null ? String(g.current_value) : "");
                    }}
                  >
                    <TrendingUp className="mr-1 h-3.5 w-3.5" /> 수치 업데이트
                  </Button>
                )}
                {(g.trainer_comment || canComment) && (
                  <div className="rounded-md border bg-muted/30 p-2">
                    <p className="text-[10px] font-medium text-muted-foreground">
                      트레이너 코멘트
                    </p>
                    {canComment ? (
                      <>
                        <Textarea
                          rows={2}
                          className="mt-1 text-xs"
                          value={commentDraft[g.id] ?? g.trainer_comment ?? ""}
                          onChange={(e) =>
                            setCommentDraft((p) => ({ ...p, [g.id]: e.target.value.slice(0, 500) }))
                          }
                          placeholder="응원 코멘트를 남겨주세요"
                        />
                        <Button
                          size="sm"
                          className="mt-1 h-7"
                          onClick={() => saveComment(g)}
                        >
                          저장
                        </Button>
                      </>
                    ) : (
                      <p className="mt-1 text-xs">{g.trainer_comment}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>새 목표 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">목표 종류</Label>
              <Select
                value={fType}
                onValueChange={(v) => {
                  const t = v as Goal["goal_type"];
                  setFType(t);
                  setFUnit(TYPE_DEFAULT_UNIT[t]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as Goal["goal_type"][]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">목표 제목</Label>
              <Input
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                placeholder="예: 체지방 감량"
                maxLength={100}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">현재 수치</Label>
                <Input
                  type="number"
                  value={fStart}
                  onChange={(e) => setFStart(e.target.value)}
                  placeholder="72"
                />
              </div>
              <div>
                <Label className="text-xs">목표 수치</Label>
                <Input
                  type="number"
                  value={fTarget}
                  onChange={(e) => setFTarget(e.target.value)}
                  placeholder="65"
                />
              </div>
              <div>
                <Label className="text-xs">단위</Label>
                <Input value={fUnit} onChange={(e) => setFUnit(e.target.value)} placeholder="kg" />
              </div>
            </div>
            <div>
              <Label className="text-xs">목표 달성일</Label>
              <Input
                type="date"
                value={fTargetDate}
                onChange={(e) => setFTargetDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>
              취소
            </Button>
            <Button onClick={submitNew}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!updating} onOpenChange={(o) => !o && setUpdating(null)}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle>수치 업데이트 - {updating?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">
                현재 수치 ({updating?.unit})
              </Label>
              <Input
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">메모(선택)</Label>
              <Textarea
                rows={2}
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value.slice(0, 200))}
                placeholder="이번 주 컨디션 등"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdating(null)}>
              취소
            </Button>
            <Button onClick={submitProgress}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
