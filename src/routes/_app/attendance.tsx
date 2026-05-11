import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, X, Trash2, FileSignature, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useMembers, useSchedules } from "@/lib/store";
import { useRole } from "@/hooks/use-role";
import { useCurrentTrainer } from "@/hooks/use-current-trainer";

export const Route = createFileRoute("/_app/attendance")({
  component: AttendancePage,
  head: () => ({ meta: [{ title: "출석 체크 | PT Studio" }] }),
});

function AttendancePage() {
  const [members, setMembers] = useMembers();
  const [schedules, setSchedules] = useSchedules();
  const { role } = useRole();
  const { trainerId: currentTrainerId } = useCurrentTrainer();
  const isTrainer = role === "trainer";
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const requestSignature = (id: string) => {
    setSchedules((prev) =>
      prev.map((x) => (x.id === id ? { ...x, signatureRequested: true } : x))
    );
    toast.success("회원에게 서명 요청을 보냈습니다.");
  };

  const items = useMemo(() => {
    const myMemberIds = new Set(
      isTrainer && currentTrainerId
        ? members.filter((m) => m.trainerId === currentTrainerId).map((m) => m.id)
        : members.map((m) => m.id)
    );
    return schedules
      .filter((s) => s.date === date && myMemberIds.has(s.memberId))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [schedules, date, members, isTrainer, currentTrainerId]);

  const mark = (id: string, attended: boolean) => {
    const s = schedules.find((x) => x.id === id);
    if (!s) return;
    const wasAttended = s.attended === true;

    setSchedules((prev) =>
      prev.map((x) => (x.id === id ? { ...x, attended } : x))
    );

    // 세션 차감 로직
    if (attended && !wasAttended) {
      setMembers((prev) =>
        prev.map((m) => (m.id === s.memberId ? { ...m, usedSessions: m.usedSessions + 1 } : m))
      );
    } else if (!attended && wasAttended) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === s.memberId ? { ...m, usedSessions: Math.max(0, m.usedSessions - 1) } : m
        )
      );
    }
    toast.success(attended ? "출석 처리되었습니다." : "결석 처리되었습니다.");
  };

  const remove = (id: string) => {
    const s = schedules.find((x) => x.id === id);
    if (s?.attended === true) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === s.memberId ? { ...m, usedSessions: Math.max(0, m.usedSessions - 1) } : m
        )
      );
    }
    setSchedules((prev) => prev.filter((x) => x.id !== id));
    toast.success("일정이 삭제되었습니다.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">출석 체크</h1>
        <p className="text-sm text-muted-foreground">날짜별 PT 일정의 출석 여부를 기록합니다.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-end gap-3">
            <div className="grid gap-2">
              <Label>날짜</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-fit" />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>시간</TableHead>
                <TableHead>회원</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">처리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    해당 날짜에 일정이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((s) => {
                  const m = members.find((x) => x.id === s.memberId);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.time}</TableCell>
                      <TableCell>{m?.name ?? "(삭제됨)"}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs",
                            s.attended === true && "bg-primary/10 text-primary",
                            s.attended === false && "bg-destructive/10 text-destructive",
                            s.attended === null && "bg-muted text-muted-foreground"
                          )}
                        >
                          {s.attended === true ? "출석" : s.attended === false ? "결석" : "예정"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={s.attended === true ? "default" : "outline"}
                          onClick={() => mark(s.id, true)}
                          className="mr-2"
                        >
                          <Check className="mr-1 h-3 w-3" /> 출석
                        </Button>
                        <Button
                          size="sm"
                          variant={s.attended === false ? "destructive" : "outline"}
                          onClick={() => mark(s.id, false)}
                          className="mr-2"
                        >
                          <X className="mr-1 h-3 w-3" /> 결석
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
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
