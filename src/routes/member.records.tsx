import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, MessageSquarePlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useMembers,
  useSchedules,
  usePublicTrainers,
  useWorkoutLogs,
  uid,
  type Schedule,
} from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/member/records")({
  component: MemberRecords,
  head: () => ({ meta: [{ title: "기록 | PT Studio" }] }),
});

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function MemberRecords() {
  const { user } = useAuth();
  const [members] = useMembers();
  const [schedules] = useSchedules();
  const [trainers] = usePublicTrainers();
  const [workoutLogs, setWorkoutLogs] = useWorkoutLogs();
  const [profileName, setProfileName] = useState("");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [openSched, setOpenSched] = useState<Schedule | null>(null);
  const [memoDraft, setMemoDraft] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfileName(data?.name ?? ""));
  }, [user]);

  const myMember = useMemo(() => {
    if (user?.id) {
      const byUserId = members.find((m) => m.userId === user.id);
      if (byUserId) return byUserId;
    }
    if (profileName) {
      return members.find((m) => m.name === profileName) ?? null;
    }
    return null;
  }, [members, profileName, user]);

  const mySchedules = useMemo(
    () => (myMember ? schedules.filter((s) => s.memberId === myMember.id) : []),
    [schedules, myMember]
  );

  // ----- 출석 달력 -----
  const monthSchedules = useMemo(
    () =>
      mySchedules.filter((s) => {
        const [y, m] = s.date.split("-").map(Number);
        return y === cursor.y && m - 1 === cursor.m;
      }),
    [mySchedules, cursor]
  );

  const dayMap = useMemo(() => {
    const map = new Map<number, Schedule>();
    monthSchedules.forEach((s) => {
      const day = Number(s.date.split("-")[2]);
      const cur = map.get(day);
      // priority: 결석 > 출석 > 예정
      if (!cur) map.set(day, s);
      else if (cur.attended === null && s.attended !== null) map.set(day, s);
      else if (cur.attended === true && s.attended === false) map.set(day, s);
    });
    return map;
  }, [monthSchedules]);

  const attendedCount = monthSchedules.filter((s) => s.attended === true).length;
  const absentCount = monthSchedules.filter((s) => s.attended === false).length;
  const totalDone = attendedCount + absentCount;
  const attendRate = totalDone > 0 ? Math.round((attendedCount / totalDone) * 100) : 0;

  const firstDow = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const moveMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  // ----- 운동기록 -----
  const sessionList = useMemo(
    () =>
      [...mySchedules]
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [mySchedules]
  );

  const logBySchedule = useMemo(() => {
    const m = new Map<string, (typeof workoutLogs)[number]>();
    workoutLogs.forEach((l) => m.set(l.scheduleId, l));
    return m;
  }, [workoutLogs]);

  const trainerName = (s: Schedule) => {
    const mem = members.find((m) => m.id === s.memberId);
    const t = trainers.find((tr) => tr.id === mem?.trainerId);
    return t?.name ?? "-";
  };

  const addMemberMemo = () => {
    if (!openSched || !memoDraft.trim() || !myMember) return;
    const existing = logBySchedule.get(openSched.id);
    const memo = { id: uid(), at: new Date().toISOString(), text: memoDraft.trim() };
    setWorkoutLogs((prev) => {
      if (existing) {
        return prev.map((l) =>
          l.id === existing.id
            ? { ...l, memberMemos: [...l.memberMemos, memo] }
            : l
        );
      }
      return [
        ...prev,
        {
          id: uid(),
          scheduleId: openSched.id,
          memberId: myMember.id,
          trainerMemo: "",
          exercises: [],
          memberMemos: [memo],
        },
      ];
    });
    setMemoDraft("");
    toast.success("메모가 저장되었습니다");
  };

  const openLog = openSched ? logBySchedule.get(openSched.id) : undefined;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="attendance">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="attendance">출석</TabsTrigger>
          <TabsTrigger value="workout">운동기록</TabsTrigger>
        </TabsList>

        {/* 출석 탭 */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => moveMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-sm">
                  {cursor.y}년 {cursor.m + 1}월
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => moveMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
                {WEEKDAYS.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  const s = day ? dayMap.get(day) : undefined;
                  let dotClass = "";
                  if (s?.attended === true) dotClass = "bg-green-500";
                  else if (s?.attended === false) dotClass = "bg-red-500";
                  else if (s) dotClass = "bg-muted-foreground/50";
                  return (
                    <div
                      key={i}
                      className="aspect-square flex flex-col items-center justify-center rounded-md text-xs"
                    >
                      {day && (
                        <>
                          <span>{day}</span>
                          <div className={`mt-0.5 h-1.5 w-1.5 rounded-full ${dotClass || "bg-transparent"}`} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-2">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">출석</p>
                <p className="text-lg font-bold text-green-600">{attendedCount}회</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">결석</p>
                <p className="text-lg font-bold text-red-600">{absentCount}회</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">출석률</p>
                <p className="text-lg font-bold text-primary">{attendRate}%</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 운동기록 탭 */}
        <TabsContent value="workout" className="space-y-2">
          {sessionList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              아직 PT 세션 기록이 없습니다.
            </p>
          ) : (
            sessionList.map((s) => {
              const log = logBySchedule.get(s.id);
              return (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/50 transition"
                  onClick={() => setOpenSched(s)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.date}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.time} · {trainerName(s)}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {log?.exercises.length
                        ? `운동 ${log.exercises.length}개`
                        : "기록 없음"}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* 운동기록 상세 */}
      <Dialog open={!!openSched} onOpenChange={(o) => !o && setOpenSched(null)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base">
              {openSched?.date} {openSched?.time}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* 트레이너 메모 */}
            <div>
              <p className="text-xs font-semibold mb-1">트레이너 메모</p>
              <p className="text-sm text-muted-foreground rounded-md bg-muted p-2 min-h-[40px]">
                {openLog?.trainerMemo || "트레이너 메모가 없습니다."}
              </p>
            </div>

            {/* 운동 목록 (조회) */}
            <div>
              <p className="text-xs font-semibold mb-1">운동 목록</p>
              {!openLog?.exercises.length ? (
                <p className="text-xs text-muted-foreground">아직 등록된 운동이 없습니다.</p>
              ) : (
                <div className="space-y-1">
                  {openLog.exercises.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between text-sm rounded-md border p-2"
                    >
                      <span className="font-medium">{e.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {e.sets}세트 · {e.weight}kg · {e.reps}회
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 회원 메모 목록 */}
            <div>
              <p className="text-xs font-semibold mb-1">내 메모</p>
              {openLog?.memberMemos.length ? (
                <ul className="space-y-1">
                  {openLog.memberMemos.map((m) => (
                    <li key={m.id} className="text-sm rounded-md bg-muted p-2">
                      <p>{m.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(m.at).toLocaleString("ko-KR")}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">메모가 없습니다.</p>
              )}
            </div>

            {/* 메모 추가 */}
            <div>
              <Textarea
                placeholder="이 세션에 대한 메모를 남겨보세요"
                value={memoDraft}
                onChange={(e) => setMemoDraft(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={addMemberMemo} disabled={!memoDraft.trim()}>
              <MessageSquarePlus className="h-4 w-4 mr-1" />
              메모 추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
