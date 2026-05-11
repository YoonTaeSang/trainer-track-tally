import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Phone, NotebookPen, TrendingUp, Plus, Trash2, UserX, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  useMembers,
  useSchedules,
  useWorkoutLogs,
  uid,
  type WorkoutEntry,
} from "@/lib/store";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/members/$memberId")({
  component: MemberDetailPage,
  head: () => ({ meta: [{ title: "회원 상세 | PT Studio" }] }),
});

type ExerciseBest = { weight: number; reps: number };

function MemberDetailPage() {
  const { memberId } = Route.useParams();
  const navigate = useNavigate();
  const [members, setMembers] = useMembers();
  const [schedules] = useSchedules();
  const [logs, setLogs] = useWorkoutLogs();
  const { role } = useRole();
  const canEdit = role === "admin" || role === "trainer";
  const isAdmin = role === "admin";
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const toggleStatus = (next: "active" | "inactive") => {
    if (!members.find((m) => m.id === memberId)) return;
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, status: next } : m)));
    toast.success(next === "inactive" ? "회원이 비활성화되었습니다." : "회원이 다시 활성화되었습니다.");
    setDeactivateOpen(false);
  };

  const member = members.find((m) => m.id === memberId);

  const myLogs = useMemo(
    () =>
      logs
        .filter((l) => l.memberId === memberId)
        .map((l) => {
          const sch = schedules.find((s) => s.id === l.scheduleId);
          return { log: l, date: sch?.date ?? "", time: sch?.time ?? "" };
        })
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [logs, schedules, memberId]
  );

  // Compute previous-best per exercise name (chronologically earlier than each log)
  const improvements = useMemo(() => {
    // Build chronological order
    const chrono = [...myLogs].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const bestSoFar = new Map<string, ExerciseBest>();
    const result = new Map<string, Map<string, boolean>>(); // logId -> (exerciseId -> improved)
    for (const { log } of chrono) {
      const map = new Map<string, boolean>();
      for (const ex of log.exercises) {
        const key = ex.name.trim();
        if (!key) continue;
        const prev = bestSoFar.get(key);
        const improved =
          !!prev && (ex.weight > prev.weight || (ex.weight === prev.weight && ex.reps > prev.reps));
        map.set(ex.id, improved);
        const newBest = !prev
          ? { weight: ex.weight, reps: ex.reps }
          : {
              weight: Math.max(prev.weight, ex.weight),
              reps: ex.weight >= prev.weight ? Math.max(prev.reps, ex.reps) : prev.reps,
            };
        bestSoFar.set(key, newBest);
      }
      result.set(log.id, map);
    }
    return result;
  }, [myLogs]);

  // ---- New note dialog ----
  const [open, setOpen] = useState(false);
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [noteTime, setNoteTime] = useState("10:00");
  const [trainerMemo, setTrainerMemo] = useState("");
  const [exercises, setExercises] = useState<WorkoutEntry[]>([]);

  const resetForm = () => {
    setNoteDate(new Date().toISOString().slice(0, 10));
    setNoteTime("10:00");
    setTrainerMemo("");
    setExercises([]);
  };

  const saveNote = () => {
    if (!member) return;
    if (!trainerMemo.trim() && exercises.length === 0) {
      toast.error("메모 또는 운동을 입력해주세요.");
      return;
    }
    const scheduleId = uid();
    // Create a synthetic schedule (marked attended) so the log links cleanly
    setLogs((prev) => [
      ...prev,
      {
        id: uid(),
        scheduleId,
        memberId: member.id,
        trainerMemo,
        exercises,
        memberMemos: [],
      },
    ]);
    // Also add a schedule row so the date/time is preserved for history view
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase
        .from("schedules")
        .insert({
          id: scheduleId,
          member_id: member.id,
          date: noteDate,
          time: noteTime,
          attended: true,
        })
        .then(({ error }) => {
          if (error) console.error(error);
        });
    });
    toast.success("PT 노트가 추가되었습니다.");
    resetForm();
    setOpen(false);
  };

  if (!member) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/members" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 목록으로
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            회원을 찾을 수 없습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  const remain = member.totalSessions - member.usedSessions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/members">
              <ArrowLeft className="mr-2 h-4 w-4" /> 목록
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{member.name}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" /> {member.phone || "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={remain <= 2 ? "destructive" : remain <= 5 ? "secondary" : "outline"}>
            잔여 {remain}회
          </Badge>
          {canEdit && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> PT 노트 추가
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <NotebookPen className="h-4 w-4" /> PT 진행 노트 히스토리 ({myLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              아직 작성된 PT 노트가 없습니다.
            </p>
          ) : (
            <ol className="relative space-y-6 border-l pl-6">
              {myLogs.map(({ log, date, time }) => {
                const impMap = improvements.get(log.id);
                return (
                  <li key={log.id} className="relative">
                    <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-semibold">{date || "(날짜 미상)"}</span>
                      <span className="text-xs text-muted-foreground">{time}</span>
                    </div>
                    {log.trainerMemo && (
                      <div className="mb-2 rounded-md bg-muted/60 p-3 text-sm">
                        <span className="mr-2 text-xs font-medium text-muted-foreground">
                          트레이너 메모
                        </span>
                        <p className="mt-1 whitespace-pre-wrap">{log.trainerMemo}</p>
                      </div>
                    )}
                    {log.exercises.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {log.exercises.map((ex) => {
                          const improved = impMap?.get(ex.id);
                          return (
                            <div
                              key={ex.id}
                              className="flex items-center justify-between rounded border px-3 py-1.5 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{ex.name || "—"}</span>
                                <span className="text-xs text-muted-foreground">
                                  {ex.sets}세트 × {ex.reps}회 · {ex.weight}kg
                                </span>
                              </div>
                              {improved && (
                                <Badge className="gap-1" variant="default">
                                  <TrendingUp className="h-3 w-3" /> 향상됨
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {log.memberMemos.length > 0 && (
                      <div className="space-y-1">
                        {log.memberMemos.map((mm) => (
                          <div
                            key={mm.id}
                            className="rounded-md border-l-2 border-primary/40 bg-background px-3 py-1.5 text-xs"
                          >
                            <span className="text-muted-foreground">회원 메모 · </span>
                            {mm.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => !v && (resetForm(), setOpen(false))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>PT 노트 추가 — {member.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>날짜</Label>
                <Input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>시간</Label>
                <Input type="time" value={noteTime} onChange={(e) => setNoteTime(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>트레이너 메모</Label>
              <Textarea
                rows={3}
                value={trainerMemo}
                onChange={(e) => setTrainerMemo(e.target.value)}
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
                  <Plus className="mr-1 h-3 w-3" /> 운동 추가
                </Button>
              </div>
              {exercises.length === 0 ? (
                <p className="text-xs text-muted-foreground">운동을 추가하세요.</p>
              ) : (
                <div className="space-y-2">
                  {exercises.map((e, i) => (
                    <div key={e.id} className="grid grid-cols-12 items-center gap-2">
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
                        onClick={() => setExercises((p) => p.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={saveNote}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
