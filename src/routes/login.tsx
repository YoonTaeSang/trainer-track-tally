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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Dumbbell } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "로그인 | PT 회원관리" }] }),
});

const emailSchema = z.string().trim().email("올바른 이메일을 입력해주세요").max(255);
// 회원가입용: 8자 이상 + 영문 + 숫자 강제
const passwordSchema = z.string()
  .min(8, "비밀번호는 8자 이상이어야 합니다")
  .max(72)
  .regex(/[a-zA-Z]/, "영문을 포함해야 합니다")
  .regex(/[0-9]/, "숫자를 포함해야 합니다");
// 로그인용: 기존 사용자 보호를 위해 길이 검증만
const loginPasswordSchema = z.string().min(1, "비밀번호를 입력해주세요").max(72);
const nameSchema = z.string().trim().min(1, "이름을 입력해주세요").max(50);
const phoneSchema = z.string().trim().min(1, "전화번호를 입력해주세요").max(20);
const birthSchema = z.string().trim().min(1, "생년월일을 입력해주세요");
const genderSchema = z.enum(["male", "female"], { errorMap: () => ({ message: "성별을 선택해주세요" }) });
const addressSchema = z.string().trim().max(200).optional();

async function redirectByRole(userId: string, navigate: ReturnType<typeof useNavigate>) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  if (roles.includes("admin")) {
    navigate({ to: "/admin" });
  } else if (roles.includes("trainer")) {
    navigate({ to: "/admin/trainers" });
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
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupBirth, setSignupBirth] = useState("");
  const [signupGender, setSignupGender] = useState<"male" | "female" | "">("");
  const [signupAddress, setSignupAddress] = useState("");

  const [signupSuccessOpen, setSignupSuccessOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);


  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectByRole(session.user.id, navigate);
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(loginEmail);
      loginPasswordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.errors[0].message);
      return;
    }

    // Dev admin bypass
    if (loginEmail === "admin@test.com" && loginPassword === "admin123") {
      localStorage.setItem("dev_admin_mode", "true");
      navigate({ to: "/admin" });
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
    if (signupPassword !== signupPasswordConfirm) {
      toast.error("비밀번호가 일치하지 않습니다");
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
    setSignupSuccessOpen(true);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(forgotEmail);
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.errors[0].message);
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForgotSent(true);
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
                  <Label htmlFor="signup-password">비밀번호 (8자 이상, 영문+숫자)</Label>
                  <Input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                  <p className="text-[11px] text-muted-foreground">예: pt123456</p>
                  {signupPassword.length > 0 && (() => {
                    const ok8 = signupPassword.length >= 8;
                    const okAlpha = /[a-zA-Z]/.test(signupPassword);
                    const okDigit = /[0-9]/.test(signupPassword);
                    return (
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className={ok8 ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                          {ok8 ? "✓" : "○"} 8자 이상
                        </span>
                        <span className={okAlpha ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                          {okAlpha ? "✓" : "○"} 영문 포함
                        </span>
                        <span className={okDigit ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                          {okDigit ? "✓" : "○"} 숫자 포함
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password-confirm">비밀번호 확인</Label>
                  <Input
                    id="signup-password-confirm"
                    type="password"
                    value={signupPasswordConfirm}
                    onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                    required
                  />
                  {signupPasswordConfirm.length > 0 && signupPassword !== signupPasswordConfirm && (
                    <p className="text-[11px] text-destructive">비밀번호가 일치하지 않습니다</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">전화번호 <span className="text-destructive">*</span></Label>
                  <Input id="signup-phone" type="tel" placeholder="010-1234-5678" value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-birth">생년월일 <span className="text-destructive">*</span></Label>
                  <Input id="signup-birth" type="date" value={signupBirth} onChange={(e) => setSignupBirth(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>성별 <span className="text-destructive">*</span></Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={signupGender === "male" ? "default" : "outline"} className="flex-1" onClick={() => setSignupGender("male")}>남성</Button>
                    <Button type="button" variant={signupGender === "female" ? "default" : "outline"} className="flex-1" onClick={() => setSignupGender("female")}>여성</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-address">주소 <span className="text-muted-foreground text-xs">(선택)</span></Label>
                  <Input id="signup-address" placeholder="주소를 입력해주세요" value={signupAddress} onChange={(e) => setSignupAddress(e.target.value)} />
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

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setForgotOpen(true); setForgotSent(false); setForgotEmail(""); }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              아이디 · 비밀번호 찾기
            </button>
          </div>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            <Link to="/login" className="underline">홈으로</Link>
          </p>
        </CardContent>
      </Card>

      {/* Signup success modal */}
      <AlertDialog open={signupSuccessOpen} onOpenChange={setSignupSuccessOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>회원가입 완료!</AlertDialogTitle>
            <AlertDialogDescription>
              관리자 승인 후 이용 가능합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setSignupSuccessOpen(false);
                window.location.assign("/login");
              }}
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Forgot password / id dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>아이디 · 비밀번호 찾기</DialogTitle>
            <DialogDescription>
              가입 시 사용한 이메일이 아이디입니다. 비밀번호를 잊으셨다면 아래에 이메일을 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          {forgotSent ? (
            <div className="space-y-4 py-2">
              <p className="text-sm">
                입력하신 이메일로 재설정 링크를 보냈습니다. 메일함을 확인해주세요.
              </p>
              <DialogFooter>
                <Button onClick={() => setForgotOpen(false)} className="w-full">확인</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">이메일</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full" disabled={forgotLoading}>
                  비밀번호 재설정 메일 보내기
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
