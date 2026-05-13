import { createFileRoute } from "@tanstack/react-router";
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
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useMembers, useSchedules, uid, type Schedule } from "@/lib/store";
import { useRole } from "@/hooks/use-role";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";
import { MonthTimeline } from "@/components/month-timeline";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
  head: () => ({ meta: [{ title: "일정 캘린더 | PT Studio" }] }),
});

function CalendarPage() {
  const [members] = useMembers();
  const [allSchedules, setSchedules] = useSchedules();
  const { role } = useRole();
  const { trainerId: currentTrainerId } = useCurrentTrainer();
  const isTrainer = role === "trainer";
  const isAdmin = role === "admin";

  const visibleMemberIds = useMemo(() => {
    if (!isTrainer || !currentTrainerId) return new Set(members.map((m) => m.id));
    return new Set(members.filter((m) => m.trainerId === currentTrainerId).map((m) => m.id));
  }, [members, isTrainer, currentTrainerId]);

  const schedules = useMemo(
    () => (isTrainer ? allSchedules.filter((s) => visibleMemberIds.has(s.memberId)) : allSchedules),
    [allSchedules, isTrainer, visibleMemberIds]
  );

  const visibleMembers = useMemo(
    () => (isTrainer ? members.filter((m) => visibleMemberIds.has(m.id)) : members),
    [members, isTrainer, visibleMemberIds]
  );

  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(new Date());
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [time, setTime] = useState("10:00");
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canManage = (s: Schedule) => {
    if (isAdmin) return true;
    if (isTrainer) {
      return !!currentTrainerId && visibleMemberIds.has(s.memberId);
    }
    return false;
  };

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, typeof schedules>();
    schedules.forEach((s) => {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    });
    return map;
  }, [schedules]);

  const selectedSchedules = selected
    ? (byDate.get(format(selected, "yyyy-MM-dd")) ?? []).sort((a, b) => a.time.localeCompare(b.time))
    : [];

  const openAdd = () => {
    setEditing(null);
    setMemberId("");
    setTime("10:00");
    setOpen(true);
  };

  const openEdit = (s: Schedule) => {
    if (!canManage(s)) return;
    setEditing(s);
    setMemberId(s.memberId);
    setTime(s.time);
    setOpen(true);
  };

  const handleSave = () => {
    if (!memberId) {
      toast.error("회원을 선택해주세요.");
      return;
    }
    if (editing) {
      // 수정
      setSchedules((prev) =>
        prev.map((x) => (x.id === editing.id ? { ...x, memberId, time } : x))
      );
      toast.success("일정이 수정되었습니다.");
    } else {
      // 추가
      if (!selected) {
        toast.error("날짜를 선택해주세요.");
        return;
      }
      const dateStr = format(selected, "yyyy-MM-dd");
      setSchedules((prev) => [
        ...prev,
        { id: uid(), memberId, date: dateStr, time, attended: null },
      ]);
      import("@/lib/availability").then((m) => m.notifyMemberOfSchedule(memberId, dateStr, time));
      toast.success("일정이 추가되었습니다.");
    }
    setOpen(false);
    setEditing(null);
    setMemberId("");
  };

  const deleteSchedule = () => {
    if (!deletingId) return;
    const target = allSchedules.find((s) => s.id === deletingId);
    if (target && !canManage(target)) {
      toast.error("삭제 권한이 없습니다.");
      setDeletingId(null);
      return;
    }
    setSchedules((prev) => prev.filter((s) => s.id !== deletingId));
    toast.success("일정이 삭제되었습니다.");
    setDeletingId(null);
  };

  const renderScheduleItem = (s: Schedule) => {
    const m = members.find((x) => x.id === s.memberId);
    const manage = canManage(s);
    return (
      <li key={s.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{m?.name ?? "(삭제됨)"}</p>
          <p className="text-xs text-muted-foreground">{s.time}</p>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              s.attended === true && "bg-primary/10 text-primary",
              s.attended === false && "bg-destructive/10 text-destructive",
              s.attended === null && "bg-muted text-muted-foreground"
            )}
          >
            {s.attended === true ? "출석" : s.attended === false ? "결석" : "예정"}
          </span>
          {manage && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)} title="수정">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setDeletingId(s.id)}
                title="삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </li>
    );
  };

  const showMonthTimeline = isAdmin || isTrainer;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">일정 캘린더</h1>
        <p className="text-sm text-muted-foreground">PT 일정을 등록하고 관리합니다.</p>
      </div>

      {showMonthTimeline ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <MonthTimeline onDateSelect={(d) => setSelected(d)} />
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">
                  {selected ? format(selected, "M월 d일") : "날짜 선택"}
                </h3>
                <Button size="sm" onClick={openAdd} disabled={!selected}>
                  <Plus className="mr-1 h-4 w-4" /> 추가
                </Button>
              </div>
              {selectedSchedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">일정이 없습니다.</p>
              ) : (
                <ul className="space-y-2">{selectedSchedules.map(renderScheduleItem)}</ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="min-w-[120px] text-center text-lg font-semibold">
                      {format(cursor, "yyyy년 M월")}
                    </h2>
                    <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" onClick={() => setCursor(new Date())}>오늘</Button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                  {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                    <div key={d} className="py-2">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((d) => {
                    const key = format(d, "yyyy-MM-dd");
                    const items = byDate.get(key) ?? [];
                    const inMonth = isSameMonth(d, cursor);
                    const isSel = selected && isSameDay(d, selected);
                    const isToday = isSameDay(d, new Date());
                    return (
                      <button
                        key={key}
                        onClick={() => setSelected(d)}
                        className={cn(
                          "flex min-h-[80px] flex-col rounded-md border p-2 text-left text-xs transition-colors",
                          inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground",
                          isSel && "border-primary ring-1 ring-primary",
                          !isSel && "hover:bg-accent"
                        )}
                      >
                        <span className={cn("text-sm font-medium", isToday && "text-primary")}>
                          {format(d, "d")}
                        </span>
                        {items.length > 0 && (
                          <span className="mt-auto inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {items.length}건
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">
                    {selected ? format(selected, "M월 d일") : "날짜 선택"}
                  </h3>
                  <Button size="sm" onClick={() => setOpen(true)} disabled={!selected}>
                    <Plus className="mr-1 h-4 w-4" /> 추가
                  </Button>
                </div>
                {selectedSchedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">일정이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedSchedules.map((s) => {
                      const m = members.find((x) => x.id === s.memberId);
                      return (
                        <li key={s.id} className="flex items-center justify-between rounded-md border p-3">
                          <div>
                            <p className="font-medium">{m?.name ?? "(삭제됨)"}</p>
                            <p className="text-xs text-muted-foreground">{s.time}</p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs",
                              s.attended === true && "bg-primary/10 text-primary",
                              s.attended === false && "bg-destructive/10 text-destructive",
                              s.attended === null && "bg-muted text-muted-foreground"
                            )}
                          >
                            {s.attended === true ? "출석" : s.attended === false ? "결석" : "예정"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={openAdd}>
              <Plus className="mr-1 h-4 w-4" /> 일정 추가
            </Button>
          </div>
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `일정 수정 (${editing.date})`
                : `일정 추가 (${selected && format(selected, "yyyy-MM-dd")})`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>회원</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="회원 선택" />
                </SelectTrigger>
                <SelectContent>
                  {visibleMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name} ({m.phone})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>시간</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={handleSave}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>일정 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 일정을 삭제하시겠습니까? 출석으로 처리된 일정은 세션 차감이 되돌아가지 않으니
              필요 시 회원 세션 수를 별도로 조정해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSchedule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
