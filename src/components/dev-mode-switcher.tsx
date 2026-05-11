import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DEV_BYPASS } from "@/lib/dev-mode";

export function DevModeSwitcher() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!DEV_BYPASS || !mounted) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-lg backdrop-blur">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        DEV 모드
      </span>
      <div className="flex gap-2">
        <Link
          to="/admin"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          관리자 보기
        </Link>
        <Link
          to="/member"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          회원 보기
        </Link>
      </div>
    </div>
  );
}
