import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { toast } from "sonner";

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read: boolean;
  created_at: string;
};

type Props = {
  myUserId: string;
  partnerId: string;
  partnerName: string;
  className?: string;
};

function dayLabel(d: Date) {
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

export function ChatPanel({ myUserId, partnerId, partnerName, className }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${myUserId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${myUserId})`
      )
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages((data ?? []) as Message[]);
    // mark partner messages as read
    const unread = (data ?? []).filter(
      (m) => m.recipient_id === myUserId && !m.read
    );
    if (unread.length > 0) {
      await supabase
        .from("messages")
        .update({ read: true })
        .in("id", unread.map((m) => m.id));
    }
  }, [myUserId, partnerId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`chat:${myUserId}:${partnerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          if (
            (m.sender_id === myUserId && m.recipient_id === partnerId) ||
            (m.sender_id === partnerId && m.recipient_id === myUserId)
          ) {
            setMessages((prev) => [...prev, m]);
            if (m.recipient_id === myUserId) {
              supabase.from("messages").update({ read: true }).eq("id", m.id).then(() => {});
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, myUserId, partnerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: myUserId,
      recipient_id: partnerId,
      body: body.slice(0, 2000),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  };

  // group by day
  let lastDay = "";

  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      <div className="border-b px-4 py-2 text-sm font-semibold">{partnerName}</div>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/20 p-3">
        {messages.length === 0 && (
          <p className="py-10 text-center text-xs text-muted-foreground">아직 대화가 없습니다.</p>
        )}
        {messages.map((m) => {
          const d = new Date(m.created_at);
          const key = d.toISOString().slice(0, 10);
          const showDay = key !== lastDay;
          lastDay = key;
          const mine = m.sender_id === myUserId;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-2 text-center text-[10px] text-muted-foreground">
                  {dayLabel(d)}
                </div>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-0.5 text-[10px] ${mine ? "opacity-75" : "text-muted-foreground"}`}>
                    {d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 border-t bg-background p-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="메시지를 입력하세요"
          maxLength={2000}
        />
        <Button size="icon" onClick={send} disabled={sending || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
