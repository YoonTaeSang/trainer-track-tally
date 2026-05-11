import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DEV_BYPASS, getDevRole, setDevRole, type DevRole } from "@/lib/dev-mode";

export function DevModeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<DevRole>("admin");
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
    setRole(getDevRole());
  }, []);

  if (!DEV_BYPASS || !mounted) return null;

  const choose = (r: DevRole) => {
    setDevRole(r);
    setRole(r);
    navigate({ to: r === "member" ? "/member" : "/admin" });
  };

  const btn = (r: DevRole, label: string) => (
    <button
      onClick={() => choose(r)}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        role === r
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-input bg-background hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-lg backdrop-blur">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        DEV 모드
      </span>
      <div className="flex gap-2">
        {btn("admin", "관리자")}
        {btn("trainer", "트레이너")}
        {btn("member", "회원")}
      </div>
    </div>
  );
}
