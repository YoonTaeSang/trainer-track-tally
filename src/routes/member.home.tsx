import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Megaphone, Sparkles, FileSignature } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useSchedules, useTrainers, type Schedule } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { SignatureDialog } from "@/components/signature-dialog";

export const Route = createFileRoute("/member/home")({
  component: MemberHome,
  head: () => ({ meta: [{ title: "홈 | PT Studio" }] }),
});

type NoticeRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  category: string;
  read: boolean;
};

function MemberHome() {
  const { user } = useAuth();
  const [members] = useMembers();
  const [schedules] = useSchedules();
  const [trainers] = useTrainers();
  const [profileName, setProfileName] = useState<string>("");
  const [notices, setNotices] = useState<NoticeRow[]>([]);

  const loadNotices = async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, created_at, category, read")
      .eq("user_id", uid)
      .eq("type", "trainer_message")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotices((data ?? []) as NoticeRow[]);
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfileName(data?.name ?? ""));

    loadNotices(user.id);
    const ch = supabase
      .channel(`home_notices:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => loadNotices(user.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const gymNotices = useMemo(() => notices.filter((n) => n.category === "gym"), [notices]);
  const trainerNotices = useMemo(() => notices.filter((n) => n.category === "trainer"), [notices]);
  const gymUnread = gymNotices.filter((n) => !n.read).length;
  const trainerUnread = trainerNotices.filter((n) => !n.read).length;

  const markCategoryRead = async (category: "gym" | "trainer") => {
    if (!user) return;
    const ids = notices.filter((n) => n.category === category && !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    setNotices((p) => p.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    await supabase.from("notifications").update({ read: true }).in("id", ids);
  };


  const myMember = useMemo(() => {
    if (!profileName) return members[0];
    return members.find((m) => m.name === profileName) ?? members[0];
  }, [members, profileName]);

  const myTrainer = useMemo(() => {
    if (!myMember?.trainerId) return null;
    return trainers.find((t) => t.id === myMember.trainerId) ?? null;
  }, [myMember, trainers]);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const nextPT = useMemo(() => {
    if (!myMember) return null;
    return schedules
      .filter((s) => s.memberId === myMember.id && s.attended === null && s.date >= todayStr)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  }, [schedules, myMember, todayStr]);

  const pendingSignatures = useMemo(() => {
    if (!myMember) return [] as Schedule[];
    return schedules
      .filter((s) => s.memberId === myMember.id && s.signatureRequested && !s.signatureUrl)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [schedules, myMember]);

  const [signing, setSigning] = useState<Schedule | null>(null);

  // 이번 달 출석 날짜 (Set)
  const attendedDays = useMemo(() => {
    if (!myMember) return new Set<number>();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const set = new Set<number>();
    schedules.forEach((s) => {
      if (s.memberId !== myMember.id) return;
      if (s.attended !== true) return;
      const [yy, mm, dd] = s.date.split("-").map(Number);
      if (yy === y && mm === m) set.add(dd);
    });
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, myMember]);

  const remain = myMember ? myMember.totalSessions - myMember.usedSessions : 0;

  // calendar grid for current month
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const greetingName = profileName || myMember?.name || "회원";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          안녕하세요, {greetingName}님 👋
        </h1>
        <p className="text-xs text-muted-foreground">오늘도 운동 화이팅!</p>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary to-primary/70 px-5 py-4 text-primary-foreground">
          <p className="text-xs opacity-80">잔여 세션</p>
          <p className="mt-1 text-4xl font-extrabold leading-none">
            {remain}
            <span className="ml-1 text-base font-medium opacity-80">
              / {myMember?.totalSessions ?? 0}회
            </span>
          </p>
        </div>
      </Card>

      {pendingSignatures.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-primary">
              <FileSignature className="h-4 w-4" /> 서명 요청이 왔습니다
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingSignatures.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border bg-background p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {s.date} {s.time}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {myTrainer?.name ?? "트레이너"} · PT 완료 확인
                  </p>
                </div>
                <Button size="sm" onClick={() => setSigning(s)}>
                  서명하기
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" /> 다음 PT 일정
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nextPT ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold">{nextPT.date}</p>
                <p className="text-sm text-muted-foreground">{nextPT.time}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  담당: {myTrainer?.name ?? "미배정"}
                </p>
              </div>
              <Badge variant="secondary">예정</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">예정된 일정이 없습니다.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            이번 달 출석 ({today.getMonth() + 1}월)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <div key={d} className="py-1 font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {cells.map((d, i) => {
              const isToday = d === today.getDate();
              const attended = d != null && attendedDays.has(d);
              return (
                <div
                  key={i}
                  className={`flex aspect-square flex-col items-center justify-center rounded-md ${
                    isToday ? "bg-accent font-semibold" : ""
                  }`}
                >
                  <span className={d ? "" : "opacity-0"}>{d ?? "."}</span>
                  <span
                    className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                      attended ? "bg-primary" : "bg-transparent"
                    }`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            출석한 날
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Megaphone className="h-4 w-4" /> 공지사항
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="gym"
            onValueChange={(v) => markCategoryRead(v as "gym" | "trainer")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="gym" className="relative">
                헬스장 공지
                {gymUnread > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {gymUnread}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="trainer" className="relative">
                트레이너 공지
                {trainerUnread > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {trainerUnread}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="gym" className="mt-3">
              <NoticeList items={gymNotices} fallbackName="PT Studio" emptyText="등록된 헬스장 공지가 없습니다." />
            </TabsContent>
            <TabsContent value="trainer" className="mt-3">
              <NoticeList items={trainerNotices} fallbackName={myTrainer?.name ?? "트레이너"} emptyText="등록된 트레이너 공지가 없습니다." />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <SignatureDialog
        open={!!signing}
        onOpenChange={(o) => !o && setSigning(null)}
        schedule={signing}
        memberName={myMember?.name ?? ""}
        trainerName={myTrainer?.name ?? "트레이너"}
      />
    </div>
  );
}

function NoticeList({
  items,
  fallbackName,
  emptyText,
}: {
  items: NoticeRow[];
  fallbackName: string;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.slice(0, 5).map((n) => (
        <li
          key={n.id}
          className={`flex gap-3 rounded-md border p-3 ${!n.read ? "border-primary/40 bg-primary/5" : ""}`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{n.title || fallbackName}</p>
              {!n.read && (
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{n.body}</p>
            <p className="text-[10px] text-muted-foreground">
              {new Date(n.created_at).toLocaleString("ko-KR")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
