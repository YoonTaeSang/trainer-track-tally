import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  reminder: "PT 리마인드",
  session_low: "세션 부족",
  trainer_message: "트레이너 메시지",
};

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!cancelled && data) setItems(data as Notification[]);
      });

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => [n, ...prev].slice(0, 30));
          toast.info(n.title, { description: n.body });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unread = items.filter((i) => !i.read).length;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    const ids = items.filter((i) => !i.read).map((i) => i.id);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", ids);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="알림" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-semibold">알림</div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              알림이 없습니다.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className={`px-3 py-2 text-sm ${!n.read ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {TYPE_LABEL[n.type] ?? n.type}
                        </Badge>
                        <p className="truncate text-xs font-medium">{n.title}</p>
                      </div>
                      {n.body && (
                        <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString("ko-KR")}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
