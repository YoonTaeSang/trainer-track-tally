import { useEffect, useMemo, useState } from "react";
import { Clock, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMembers, useSchedules } from "@/lib/store";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06~22

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function TodayTimeline() {
  const [members] = useMembers();
  const [schedules] = useSchedules();
  const { trainerId } = useCurrentTrainer();

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = now.toISOString().slice(0, 10);
  const myMemberIds = useMemo(
    () => new Set(members.filter((m) => m.trainerId === trainerId).map((m) => m.id)),
    [members, trainerId]
  );
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const todays = useMemo(
    () =>
      schedules
        .filter((s) => s.date === today && (trainerId ? myMemberIds.has(s.memberId) : true))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [schedules, today, trainerId, myMemberIds]
  );

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nextSchedule = todays.find((s) => s.attended === null && timeToMinutes(s.time) >= nowMin);

  const remainText = useMemo(() => {
    if (!nextSchedule) return null;
    const diff = timeToMinutes(nextSchedule.time) - nowMin;
    if (diff <= 0) return "지금";
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}시간 ${m}분 후` : `${m}분 후`;
  }, [nextSchedule, nowMin]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> 오늘의 PT 타임라인
            <span className="text-xs font-normal text-muted-foreground">({today})</span>
          </CardTitle>
          {nextSchedule ? (
            <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <Timer className="h-3.5 w-3.5" />
              다음 PT — {nextSchedule.time} {memberById.get(nextSchedule.memberId)?.name ?? "—"} ·{" "}
              <span className="font-semibold">{remainText}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">남은 일정 없음</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[60px_1fr] gap-x-3">
          {HOURS.map((h) => {
            const slotItems = todays.filter((s) => parseInt(s.time.slice(0, 2), 10) === h);
            const isCurrentHour = now.getHours() === h && today === now.toISOString().slice(0, 10);
            return (
              <div key={h} className="contents">
                <div
                  className={cn(
                    "border-t py-2 text-right text-xs text-muted-foreground",
                    isCurrentHour && "font-semibold text-primary"
                  )}
                >
                  {pad(h)}:00
                </div>
                <div className={cn("min-h-12 border-t py-1.5", isCurrentHour && "bg-primary/5")}>
                  {slotItems.length === 0 ? (
                    <div className="h-full" />
                  ) : (
                    <div className="space-y-1">
                      {slotItems.map((s) => {
                        const past = timeToMinutes(s.time) < nowMin;
                        const status =
                          s.attended === true
                            ? { label: "완료", variant: "default" as const }
                            : s.attended === false
                            ? { label: "결석", variant: "destructive" as const }
                            : { label: "예정", variant: "secondary" as const };
                        const member = memberById.get(s.memberId);
                        return (
                          <div
                            key={s.id}
                            className={cn(
                              "flex items-center justify-between rounded-md border bg-card px-3 py-1.5 text-sm",
                              past && s.attended === null && "opacity-50",
                              past && s.attended !== null && "opacity-70"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {s.time}
                              </span>
                              <span className="font-medium">{member?.name ?? "(삭제됨)"}</span>
                            </div>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
