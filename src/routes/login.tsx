import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Dumbbell } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "로그인 | PT 회원관리" }] }),
});

const emailSchema = z.string().trim().email("올바른 이메일을 입력해주세요").max(255);
const passwordSchema = z.string().min(6, "비밀번호는 6자 이상이어야 합니다").max(72);
const nameSchema = z.string().trim().min(1, "이름을 입력해주세요").max(50);
const phoneSchema = z.string().trim().min(1, "전화번호를 입력해주세요").max(20);
const birthSchema = z.string().trim().min(1, "생년월일을 입력해주세요");
const genderSchema = z.enum(["male", "female", "other"], { errorMap: () => ({ message: "성별을 선택해주세요" }) });
const addressSchema = z.string().trim().max(200).optional();

async function redirectByRole(userId: string, navigate: ReturnType<typeof useNavigate>) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  if (roles.includes("admin") || roles.includes("trainer")) {
    navigate({ to: "/admin" });
  } else {
    navigate({ to: "/member" });
  }
}

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupBirth, setSignupBirth] = useState("");
  const [signupGender, setSignupGender] = useState<"male" | "female" | "other" | "">("");
  const [signupAddress, setSignupAddress] = useState("");
  const [signupRole, setSignupRole] = useState<"trainer" | "member">("member");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectByRole(session.user.id, navigate);
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.errors[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "이메일 또는 비밀번호가 올바르지 않습니다" : error.message);
      return;
    }
    toast.success("로그인되었습니다");
    if (data.user) await redirectByRole(data.user.id, navigate);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      nameSchema.parse(signupName);
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
      phoneSchema.parse(signupPhone);
      birthSchema.parse(signupBirth);
      genderSchema.parse(signupGender);
      addressSchema.parse(signupAddress);
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.errors[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          name: signupName,
          role: signupRole,
          phone: signupPhone,
          birth_date: signupBirth,
          gender: signupGender,
          address: signupAddress,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("already registered") ? "이미 가입된 이메일입니다" : error.message);
      return;
    }
    toast.success("가입 완료! 이메일 인증 후 로그인해주세요");
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/login`,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google 로그인 실패");
      return;
    }
    if (result.redirected) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await redirectByRole(session.user.id, navigate);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Dumbbell className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>PT 회원관리</CardTitle>
          <CardDescription>로그인하거나 새 계정을 만드세요</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">로그인</TabsTrigger>
              <TabsTrigger value="signup">회원가입</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">이메일</Label>
                  <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">비밀번호</Label>
                  <Input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>로그인</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">이름</Label>
                  <Input id="signup-name" value={signupName} onChange={(e) => setSignupName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">이메일</Label>
                  <Input id="signup-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">비밀번호 (6자 이상)</Label>
                  <Input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>역할</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={signupRole === "member" ? "default" : "outline"} className="flex-1" onClick={() => setSignupRole("member")}>회원</Button>
                    <Button type="button" variant={signupRole === "trainer" ? "default" : "outline"} className="flex-1" onClick={() => setSignupRole("trainer")}>트레이너</Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>회원가입</Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">또는</span></div>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
            Google로 계속하기
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/login" className="underline">홈으로</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
