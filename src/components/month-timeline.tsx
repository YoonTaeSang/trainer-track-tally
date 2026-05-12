import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useMembers, useSchedules, useTrainers, type Schedule } from "@/lib/store";
import { useRole } from "@/hooks/use-role";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";

// Distinct, accessible HSL palette for trainer color coding.
const TRAINER_PALETTE = [
  { bg: "bg-sky-500/15", border: "border-sky-500/40", text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { bg: "bg-violet-500/15", border: "border-violet-500/40", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  { bg: "bg-pink-500/15", border: "border-pink-500/40", text: "text-pink-700 dark:text-pink-300", dot: "bg-pink-500" },
  { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  { bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
  { bg: "bg-rose-500/15", border: "border-rose-500/40", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  { bg: "bg-indigo-500/15", border: "border-indigo-500/40", text: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
];
const UNASSIGNED_COLOR = {
  bg: "bg-muted",
  border: "border-border",
  text: "text-muted-foreground",
  dot: "bg-muted-foreground",
};

const OVERLAP_THRESHOLD = 3;

export function MonthTimeline({ onDateSelect }: { onDateSelect?: (date: Date) => void }) {
  const [members] = useMembers();
  const [schedules, setSchedules] = useSchedules();
  const [trainers] = useTrainers();
  const { role } = useRole();
  const { trainerId: currentTrainerId } = useCurrentTrainer();
  const isAdmin = role === "admin";

  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [overlapOpen, setOverlapOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [editTime, setEditTime] = useState("10:00");

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const trainerColor = useMemo(() => {
    const map = new Map<string, (typeof TRAINER_PALETTE)[number]>();
    trainers.forEach((t, i) => map.set(t.id, TRAINER_PALETTE[i % TRAINER_PALETTE.length]));
    return map;
  }, [trainers]);
  const trainerById = useMemo(() => new Map(trainers.map((t) => [t.id, t])), [trainers]);

  const colorFor = (memberId: string) => {
    const m = memberById.get(memberId);
    if (!m?.trainerId) return UNASSIGNED_COLOR;
    return trainerColor.get(m.trainerId) ?? UNASSIGNED_COLOR;
  };

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    schedules.forEach((s) => {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    });
    return map;
  }, [schedules]);

  // Returns overlap groups (>= threshold at same time) for a date.
  const overlapGroupsFor = (key: string) => {
    const items = byDate.get(key) ?? [];
    const grouped = new Map<string, Schedule[]>();
    items.forEach((s) => {
      const arr = grouped.get(s.time) ?? [];
      arr.push(s);
      grouped.set(s.time, arr);
    });
    return Array.from(grouped.entries())
      .filter(([, arr]) => arr.length >= OVERLAP_THRESHOLD)
      .sort((a, b) => a[0].localeCompare(b[0]));
  };

  const selectedKey = format(selected, "yyyy-MM-dd");
  const selectedItems = (byDate.get(selectedKey) ?? []).slice().sort((a, b) => a.time.localeCompare(b.time));
  const selectedOverlaps = overlapGroupsFor(selectedKey);

  // Group selected day items by time for side-by-side rendering.
  const selectedByTime = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    selectedItems.forEach((s) => {
      const arr = map.get(s.time) ?? [];
      arr.push(s);
      map.set(s.time, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [selectedItems]);

  const canEdit = (s: Schedule) => {
    if (isAdmin) return true;
    if (!currentTrainerId) return false;
    const m = memberById.get(s.memberId);
    return m?.trainerId === currentTrainerId;
  };

  const handleDelete = (s: Schedule) => {
    if (!canEdit(s)) {
      toast.error("본인 담당 회원의 일정만 삭제할 수 있습니다.");
      return;
    }
    if (!confirm("이 일정을 삭제할까요?")) return;
    setSchedules((prev) => prev.filter((x) => x.id !== s.id));
    toast.success("일정이 삭제되었습니다.");
  };

  const openEdit = (s: Schedule) => {
    if (!canEdit(s)) {
      toast.error("본인 담당 회원의 일정만 수정할 수 있습니다.");
      return;
    }
    setEditing(s);
    setEditTime(s.time);
  };

  const saveEdit = () => {
    if (!editing) return;
    setSchedules((prev) => prev.map((x) => (x.id === editing.id ? { ...x, time: editTime } : x)));
    toast.success("일정이 수정되었습니다.");
    setEditing(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4" /> PT 월간 타임라인
            <span className="text-xs font-normal text-muted-foreground">
              {isAdmin ? "전체 일정 관리" : "전체 일정 조회 · 본인 담당 수정"}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[100px] text-center text-sm font-semibold">
              {format(cursor, "yyyy년 M월")}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
              이번달
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Trainer legend */}
        {trainers.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {trainers.map((t) => {
              const c = trainerColor.get(t.id) ?? UNASSIGNED_COLOR;
              return (
                <span key={t.id} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", c.dot)} />
                  {t.name}
                </span>
              );
            })}
          </div>
        )}

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div key={d} className="py-1.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const items = (byDate.get(key) ?? []).slice().sort((a, b) => a.time.localeCompare(b.time));
            const inMonth = isSameMonth(d, cursor);
            const isSel = isSameDay(d, selected);
            const isToday = isSameDay(d, new Date());
            const overlapGroups = overlapGroupsFor(key);
            const hasOverlap = overlapGroups.length > 0;
            return (
              <button
                key={key}
                onClick={() => { setSelected(d); onDateSelect?.(d); }}
                className={cn(
                  "flex min-h-[88px] flex-col gap-1 rounded-md border p-1.5 text-left text-xs transition-colors",
                  inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground",
                  isSel && "border-primary ring-1 ring-primary",
                  !isSel && "hover:bg-accent"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm font-medium", isToday && "text-primary")}>
                    {format(d, "d")}
                  </span>
                  {hasOverlap && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(d);
                        setOverlapOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          setSelected(d);
                          setOverlapOpen(true);
                        }
                      }}
                      className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400"
                    >
                      <AlertTriangle className="h-3 w-3" />겹침
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {items.slice(0, 3).map((s) => {
                    const c = colorFor(s.memberId);
                    return (
                      <span
                        key={s.id}
                        className={cn("inline-flex items-center rounded px-1 py-0.5 text-[10px]", c.bg, c.text)}
                      >
                        {s.time}
                      </span>
                    );
                  })}
                  {items.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{items.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="mt-5 rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{format(selected, "M월 d일 (E)")} 상세 일정</h3>
            <span className="text-xs text-muted-foreground">{selectedItems.length}건</span>
          </div>
          {selectedByTime.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">일정이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {selectedByTime.map(([time, group]) => (
                <li key={time} className="flex items-start gap-3">
                  <span className="mt-1 w-12 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {time}
                  </span>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {group.map((s) => {
                      const c = colorFor(s.memberId);
                      const m = memberById.get(s.memberId);
                      const t = m?.trainerId ? trainerById.get(m.trainerId) : null;
                      const editable = canEdit(s);
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm",
                            c.bg,
                            c.border
                          )}
                        >
                          <span className={cn("h-2 w-2 rounded-full", c.dot)} />
                          <span className="font-medium">{m?.name ?? "(삭제됨)"}</span>
                          <span className="text-xs text-muted-foreground">· {t?.name ?? "미배정"}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            disabled={!editable}
                            onClick={() => openEdit(s)}
                            title={editable ? "수정" : "권한 없음"}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            disabled={!editable}
                            onClick={() => handleDelete(s)}
                            title={editable ? "삭제" : "권한 없음"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                    {group.length >= OVERLAP_THRESHOLD && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                        <AlertTriangle className="h-3 w-3" />
                        {group.length}건 겹침
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      {/* Overlap dialog */}
      <Dialog open={overlapOpen} onOpenChange={setOverlapOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              {format(selected, "M월 d일")} 겹치는 일정
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedOverlaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">겹치는 일정이 없습니다.</p>
            ) : (
              selectedOverlaps.map(([time, group]) => (
                <div key={time} className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-semibold">{time} · {group.length}건</p>
                  <ul className="space-y-1.5">
                    {group.map((s) => {
                      const c = colorFor(s.memberId);
                      const m = memberById.get(s.memberId);
                      const t = m?.trainerId ? trainerById.get(m.trainerId) : null;
                      return (
                        <li key={s.id} className="flex items-center gap-2 text-sm">
                          <span className={cn("h-2 w-2 rounded-full", c.dot)} />
                          <span className="font-medium">{m?.name ?? "(삭제됨)"}</span>
                          <span className="text-xs text-muted-foreground">· {t?.name ?? "미배정"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit time dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>일정 시간 수정</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 py-2">
              <div className="text-sm text-muted-foreground">
                {memberById.get(editing.memberId)?.name ?? "(삭제됨)"} · {editing.date}
              </div>
              <div className="grid gap-2">
                <Label>시간</Label>
                <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>취소</Button>
            <Button onClick={saveEdit}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
