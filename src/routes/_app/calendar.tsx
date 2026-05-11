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
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useMembers, useSchedules, uid } from "@/lib/store";
import { useRole } from "@/hooks/use-role";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
  head: () => ({ meta: [{ title: "일정 캘린더 | PT Studio" }] }),
});

function CalendarPage() {
  const [members] = useMembers();
  const [schedules, setSchedules] = useSchedules();
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(new Date());
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [time, setTime] = useState("10:00");

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

  const addSchedule = () => {
    if (!selected || !memberId) {
      toast.error("회원을 선택해주세요.");
      return;
    }
    setSchedules((prev) => [
      ...prev,
      {
        id: uid(),
        memberId,
        date: format(selected, "yyyy-MM-dd"),
        time,
        attended: null,
      },
    ]);
    toast.success("일정이 추가되었습니다.");
    setOpen(false);
    setMemberId("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">일정 캘린더</h1>
        <p className="text-sm text-muted-foreground">PT 일정을 등록하고 관리합니다.</p>
      </div>

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>일정 추가 ({selected && format(selected, "yyyy-MM-dd")})</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>회원</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="회원 선택" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
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
            <Button onClick={addSchedule}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
