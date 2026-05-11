import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Phone, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTrainers, useMembers, useSchedules } from "@/lib/store";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { GoalsSection } from "@/components/goals-section";
import { Target } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_app/admin/trainers/$trainerId")({
  component: TrainerDetailPage,
  head: () => ({ meta: [{ title: "트레이너 상세 | PT Studio" }] }),
});

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06~22
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=일
  const diff = (day + 6) % 7; // make Monday=0
  const r = new Date(d);
  r.setDate(d.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function TrainerDetailPage() {
  const { trainerId } = Route.useParams();
  const navigate = useNavigate();
  const { allowed } = useRoleGuard(["admin"]);
  const [trainers] = useTrainers();
  const [members] = useMembers();
  const [schedules] = useSchedules();

  if (!allowed) return null;

  const trainer = trainers.find((t) => t.id === trainerId);
  const myMembers = useMemo(
    () => members.filter((m) => m.trainerId === trainerId),
    [members, trainerId]
  );
  const myMemberIds = useMemo(() => new Set(myMembers.map((m) => m.id)), [myMembers]);

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekDates = useMemo(
    () =>
      DAYS.map((_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d.toISOString().slice(0, 10);
      }),
    [weekStart]
  );

  // Build cell map: key = `${dateStr}|${hour}` -> array of {memberName, time}
  const grid = useMemo(() => {
    const map = new Map<string, { name: string; time: string }[]>();
    const memberById = new Map(members.map((m) => [m.id, m]));
    for (const s of schedules) {
      if (!myMemberIds.has(s.memberId)) continue;
      if (!weekDates.includes(s.date)) continue;
      const hour = parseInt(s.time.slice(0, 2), 10);
      if (isNaN(hour)) continue;
      const key = `${s.date}|${hour}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({
        name: memberById.get(s.memberId)?.name ?? "(삭제됨)",
        time: s.time,
      });
    }
    return map;
  }, [schedules, myMemberIds, members, weekDates]);

  if (!trainer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/trainers" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 목록으로
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            트레이너를 찾을 수 없습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/trainers">
              <ArrowLeft className="mr-2 h-4 w-4" /> 목록
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{trainer.name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" /> {trainer.phone || "—"}
            </p>
          </div>
        </div>
      </div>

      {trainer.memo && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{trainer.memo}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> 담당 회원 ({myMembers.length}명)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead>세션</TableHead>
                <TableHead>잔여</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    담당 회원이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                myMembers.map((m) => {
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
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>주간 일정 ({weekDates[0]} ~ {weekDates[6]})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-16 border bg-muted/50 p-2 text-left font-medium text-muted-foreground">
                    시간
                  </th>
                  {DAYS.map((d, i) => {
                    const dateStr = weekDates[i];
                    const isToday = dateStr === new Date().toISOString().slice(0, 10);
                    return (
                      <th
                        key={d}
                        className={`border p-2 text-center font-medium ${
                          isToday ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <div>{d}</div>
                        <div className="text-[10px] font-normal">{dateStr.slice(5)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((h) => (
                  <tr key={h}>
                    <td className="sticky left-0 z-10 border bg-background p-2 text-muted-foreground">
                      {String(h).padStart(2, "0")}:00
                    </td>
                    {weekDates.map((dateStr) => {
                      const cell = grid.get(`${dateStr}|${h}`) ?? [];
                      return (
                        <td key={dateStr} className="h-14 border p-1 align-top">
                          {cell.map((c, idx) => (
                            <div
                              key={idx}
                              className="mb-1 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                            >
                              {c.time} {c.name}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
