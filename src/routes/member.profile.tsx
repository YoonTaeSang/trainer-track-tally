import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  LogOut,
  User as UserIcon,
  KeyRound,
  Plus,
  Trash2,
  Ruler,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useTrainers } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { GoalsSection } from "@/components/goals-section";

export const Route = createFileRoute("/member/profile")({
  component: MemberProfile,
  head: () => ({ meta: [{ title: "내정보 | PT Studio" }] }),
});

type Metric = {
  id: string;
  height: number | null;
  weight: number | null;
  recorded_at: string;
};

const metricSchema = z.object({
  height: z.number().min(50).max(250).nullable(),
  weight: z.number().min(20).max(300).nullable(),
  recorded_at: z.string().min(1),
});

const passwordSchema = z
  .string()
  .min(8, "8자 이상 입력해주세요")
  .max(72, "72자 이하로 입력해주세요");

function MemberProfile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [members] = useMembers();
  const [trainers] = useTrainers();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [createdAt, setCreatedAt] = useState<string>("");

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [newH, setNewH] = useState("");
  const [newW, setNewW] = useState("");
  const [newDate, setNewDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [goal, setGoal] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  // Profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name, phone, created_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.name ?? "");
        setPhone(data?.phone ?? "");
        setCreatedAt(data?.created_at ?? "");
      });
  }, [user]);

  // Body metrics
  const loadMetrics = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("body_metrics")
      .select("id, height, weight, recorded_at")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false });
    if (data) setMetrics(data as Metric[]);
  };
  useEffect(() => {
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Goal
  useEffect(() => {
    if (!user) return;
    supabase
      .from("member_goals")
      .select("goal_text")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setGoal(data?.goal_text ?? ""));
  }, [user]);

  const myMember = useMemo(
    () => (name ? members.find((m) => m.name === name) : undefined),
    [members, name]
  );
  const trainer = trainers.find((t) => t.id === myMember?.trainerId);

  const addMetric = async () => {
    if (!user) return;
    const parsed = metricSchema.safeParse({
      height: newH ? Number(newH) : null,
      weight: newW ? Number(newW) : null,
      recorded_at: newDate,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요");
      return;
    }
    if (parsed.data.height === null && parsed.data.weight === null) {
      toast.error("키 또는 몸무게 중 하나는 입력해주세요");
      return;
    }
    const { error } = await supabase.from("body_metrics").insert({
      user_id: user.id,
      ...parsed.data,
    });
    if (error) return toast.error(error.message);
    setNewH("");
    setNewW("");
    toast.success("기록되었습니다");
    loadMetrics();
  };

  const removeMetric = async (id: string) => {
    const { error } = await supabase.from("body_metrics").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setMetrics((p) => p.filter((m) => m.id !== id));
  };

  const saveGoal = async () => {
    if (!user) return;
    setGoalSaving(true);
    const { error } = await supabase
      .from("member_goals")
      .upsert({ user_id: user.id, goal_text: goal.slice(0, 200) });
    setGoalSaving(false);
    if (error) return toast.error(error.message);
    toast.success("목표가 저장되었습니다");
  };

  const changePassword = async () => {
    const parsed = passwordSchema.safeParse(newPw);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (newPw !== newPw2) return toast.error("비밀번호가 일치하지 않습니다");
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) return toast.error(error.message);
    toast.success("비밀번호가 변경되었습니다");
    setNewPw("");
    setNewPw2("");
    setPwOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("로그아웃되었습니다");
    navigate({ to: "/login" });
  };

  return (
    <div className="space-y-4">
      {/* Profile */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">프로필</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserIcon className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-base font-semibold">{name || "회원"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              {phone && <p className="text-xs text-muted-foreground">{phone}</p>}
              {createdAt && (
                <p className="text-xs text-muted-foreground">
                  가입일: {createdAt.slice(0, 10)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trainer */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">담당 트레이너</CardTitle>
        </CardHeader>
        <CardContent>
          {trainer ? (
            <div>
              <p className="text-sm font-medium">{trainer.name}</p>
              <p className="text-xs text-muted-foreground">{trainer.phone}</p>
              {trainer.memo && (
                <p className="mt-1 text-xs text-muted-foreground">{trainer.memo}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">담당 트레이너가 배정되지 않았습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* Goal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Target className="h-4 w-4" /> 목표
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value.slice(0, 200))}
            placeholder="예: 체지방 감량 5kg"
            rows={2}
            maxLength={200}
          />
          <Button size="sm" onClick={saveGoal} disabled={goalSaving} className="w-full">
            저장
          </Button>
        </CardContent>
      </Card>

      {/* Body metrics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Ruler className="h-4 w-4" /> 신체 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-3">
              <Label className="text-[10px]">키(cm)</Label>
              <Input
                type="number"
                value={newH}
                onChange={(e) => setNewH(e.target.value)}
                placeholder="170"
              />
            </div>
            <div className="col-span-3">
              <Label className="text-[10px]">몸무게(kg)</Label>
              <Input
                type="number"
                value={newW}
                onChange={(e) => setNewW(e.target.value)}
                placeholder="65"
              />
            </div>
            <div className="col-span-4">
              <Label className="text-[10px]">날짜</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="col-span-2 flex items-end">
              <Button size="icon" onClick={addMetric} className="w-full">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {metrics.length === 0 ? (
            <p className="text-xs text-muted-foreground">아직 기록이 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {metrics.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <div>
                    <p className="text-xs text-muted-foreground">{m.recorded_at}</p>
                    <p>
                      {m.height ? `${m.height}cm` : "-"} ·{" "}
                      {m.weight ? `${m.weight}kg` : "-"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMetric(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={() => setPwOpen(true)}>
        <KeyRound className="mr-2 h-4 w-4" />
        비밀번호 변경
      </Button>

      <Button variant="outline" className="w-full" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        로그아웃
      </Button>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle>비밀번호 변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">새 비밀번호</Label>
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                maxLength={72}
              />
            </div>
            <div>
              <Label className="text-xs">새 비밀번호 확인</Label>
              <Input
                type="password"
                value={newPw2}
                onChange={(e) => setNewPw2(e.target.value)}
                maxLength={72}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)}>
              취소
            </Button>
            <Button onClick={changePassword}>변경</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
