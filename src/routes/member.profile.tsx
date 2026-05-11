import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/member/profile")({
  component: MemberProfile,
  head: () => ({ meta: [{ title: "내정보 | PT Studio" }] }),
});

function MemberProfile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name, phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.name ?? "");
        setPhone(data?.phone ?? "");
      });
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    toast.success("로그아웃되었습니다");
    navigate({ to: "/login" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">내 정보</CardTitle>
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
            </div>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        로그아웃
      </Button>
    </div>
  );
}
