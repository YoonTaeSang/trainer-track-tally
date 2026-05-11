import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus } from "lucide-react";
import {
  useMembers,
  useSchedules,
  useWorkoutLogs,
  uid,
  type WorkoutEntry,
} from "@/lib/store";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";

export const Route = createFileRoute("/_app/admin/workouts")({
  component: AdminWorkouts,
  head: () => ({ meta: [{ title: "운동기록 관리 | PT Studio" }] }),
});

function AdminWorkouts() {
  const [allMembers] = useMembers();
  const [schedules] = useSchedules();
  const [workoutLogs, setWorkoutLogs] = useWorkoutLogs();
  const { role } = useRole();
  const { trainerId: currentTrainerId } = useCurrentTrainer();
  const isTrainer = role === "trainer";
  const members = useMemo(
    () =>
      isTrainer && currentTrainerId
        ? allMembers.filter((m) => m.trainerId === currentTrainerId)
        : allMembers,
    [allMembers, isTrainer, currentTrainerId]
  );
  const myMemberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const scoped = schedules.filter((s) => myMemberIds.has(s.memberId));
    const list = memberFilter === "all"
      ? scoped
      : scoped.filter((s) => s.memberId === memberFilter);
    return [...list].sort((a, b) =>
      (b.date + b.time).localeCompare(a.date + a.time)
    );
  }, [schedules, memberFilter, myMemberIds]);

  const logBySchedule = useMemo(() => {
    const m = new Map<string, (typeof workoutLogs)[number]>();
    workoutLogs.forEach((l) => m.set(l.scheduleId, l));
    return m;
  }, [workoutLogs]);

  const editing = editingScheduleId
    ? schedules.find((s) => s.id === editingScheduleId)
    : null;
  const editingLog = editing ? logBySchedule.get(editing.id) : undefined;

  const [trainerMemo, setTrainerMemo] = useState("");
  const [exercises, setExercises] = useState<WorkoutEntry[]>([]);

  const openEdit = (scheduleId: string) => {
    const log = logBySchedule.get(scheduleId);
    setTrainerMemo(log?.trainerMemo ?? "");
    setExercises(log?.exercises ?? []);
    setEditingScheduleId(scheduleId);
  };

  const save = () => {
    if (!editing) return;
    setWorkoutLogs((prev) => {
      const idx = prev.findIndex((l) => l.scheduleId === editing.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], trainerMemo, exercises };
        return next;
      }
      return [
        ...prev,
        {
          id: uid(),
          scheduleId: editing.id,
          memberId: editing.memberId,
          trainerMemo,
          exercises,
          memberMemos: [],
        },
      ];
    });
    toast.success("운동기록이 저장되었습니다");
    setEditingScheduleId(null);
  };

  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "-";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">운동기록 관리</h1>
        <p className="text-sm text-muted-foreground">
          PT 세션별 운동기록을 입력합니다
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">세션 목록</CardTitle>
            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 회원</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              세션이 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => {
                const log = logBySchedule.get(s.id);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {memberName(s.memberId)} · {s.date} {s.time}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log?.exercises.length
                          ? `운동 ${log.exercises.length}개 기록됨`
                          : "기록 없음"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openEdit(s.id)}>
                      {log ? "수정" : "기록 입력"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editingScheduleId}
        onOpenChange={(o) => !o && setEditingScheduleId(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing && `${memberName(editing.memberId)} · ${editing.date} ${editing.time}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1">
              <Label>트레이너 메모</Label>
              <Textarea
                value={trainerMemo}
                onChange={(e) => setTrainerMemo(e.target.value)}
                rows={2}
                placeholder="세션 메모"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>운동 목록</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setExercises((p) => [
                      ...p,
                      { id: uid(), name: "", sets: 3, weight: 0, reps: 10 },
                    ])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> 운동 추가
                </Button>
              </div>
              {exercises.length === 0 ? (
                <p className="text-xs text-muted-foreground">운동을 추가하세요.</p>
              ) : (
                <div className="space-y-2">
                  {exercises.map((e, i) => (
                    <div key={e.id} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-4"
                        placeholder="운동 이름"
                        value={e.name}
                        onChange={(ev) =>
                          setExercises((p) =>
                            p.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x))
                          )
                        }
                      />
                      <Input
                        className="col-span-2"
                        type="number"
                        placeholder="세트"
                        value={e.sets}
                        onChange={(ev) =>
                          setExercises((p) =>
                            p.map((x, j) =>
                              j === i ? { ...x, sets: Number(ev.target.value) } : x
                            )
                          )
                        }
                      />
                      <Input
                        className="col-span-2"
                        type="number"
                        placeholder="kg"
                        value={e.weight}
                        onChange={(ev) =>
                          setExercises((p) =>
                            p.map((x, j) =>
                              j === i ? { ...x, weight: Number(ev.target.value) } : x
                            )
                          )
                        }
                      />
                      <Input
                        className="col-span-2"
                        type="number"
                        placeholder="횟수"
                        value={e.reps}
                        onChange={(ev) =>
                          setExercises((p) =>
                            p.map((x, j) =>
                              j === i ? { ...x, reps: Number(ev.target.value) } : x
                            )
                          )
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="col-span-2"
                        onClick={() =>
                          setExercises((p) => p.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editing?.signatureUrl ? (
              <div className="space-y-1">
                <Label>회원 서명</Label>
                <img
                  src={editing.signatureUrl}
                  alt="회원 서명"
                  className="w-full max-w-[320px] rounded-md border bg-white"
                />
                {editing.signedAt && (
                  <p className="text-[11px] text-muted-foreground">
                    서명일: {new Date(editing.signedAt).toLocaleString("ko-KR")}
                  </p>
                )}
              </div>
            ) : null}

            {editingLog?.memberMemos.length ? (
              <div className="space-y-1">
                <Label>회원 메모 (조회 전용)</Label>
                <ul className="space-y-1">
                  {editingLog.memberMemos.map((m) => (
                    <li key={m.id} className="text-xs rounded bg-muted p-2">
                      {m.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingScheduleId(null)}>
              취소
            </Button>
            <Button onClick={save}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
