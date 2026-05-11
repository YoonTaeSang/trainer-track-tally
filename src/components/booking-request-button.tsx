import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Schedule, Member, Trainer } from "@/lib/store";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isAtLeastOneDayAhead(date: string, time: string) {
  const dt = new Date(`${date}T${time}:00`);
  return dt.getTime() - Date.now() >= DAY_MS;
}

type Props = {
  schedule: Schedule;
  member: Member;
  trainer: Trainer | null;
  userId: string;
  onSubmitted: () => void;
};

export function BookingRequestButtons({ schedule, member, trainer, userId, onSubmitted }: Props) {
  const [openChange, setOpenChange] = useState(false);
  const [newDate, setNewDate] = useState(schedule.date);
  const [newTime, setNewTime] = useState(schedule.time);
  const [submitting, setSubmitting] = useState(false);

  const guard = () => {
    if (!isAtLeastOneDayAhead(schedule.date, schedule.time)) {
      toast.error("수업 1일 전까지만 신청 가능합니다");
      return false;
    }
    return true;
  };

  const submit = async (type: "cancel" | "change") => {
    if (!guard()) return;
    setSubmitting(true);
    try {
      const trainerUserId = trainer?.userId ?? null;
      const { error } = await supabase.from("schedule_requests").insert({
        member_user_id: userId,
        trainer_user_id: trainerUserId,
        member_name: member.name,
        trainer_name: trainer?.name ?? null,
        original_schedule_id: schedule.id,
        original_date: schedule.date,
        original_time: schedule.time,
        request_type: type,
        requested_date: type === "change" ? newDate : null,
        requested_time: type === "change" ? newTime : null,
      });
      if (error) throw error;
      if (trainerUserId) {
        await supabase.from("notifications").insert({
          user_id: trainerUserId,
          type: "trainer_message",
          title: type === "cancel" ? "취소 신청" : "변경 신청",
          body:
            type === "cancel"
              ? `${member.name} · ${schedule.date} ${schedule.time} 취소 요청`
              : `${member.name} · ${schedule.date} ${schedule.time} → ${newDate} ${newTime}`,
        });
      }
      toast.success("신청이 접수되었습니다. 트레이너 승인을 기다려주세요.");
      setOpenChange(false);
      onSubmitted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류가 발생했습니다";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={() => submit("cancel")}
          disabled={submitting}
        >
          취소 신청
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={() => {
            if (!guard()) return;
            setOpenChange(true);
          }}
          disabled={submitting}
        >
          변경 신청
        </Button>
      </div>

      <Dialog open={openChange} onOpenChange={setOpenChange}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle>일정 변경 신청</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              기존: {schedule.date} {schedule.time}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">새 날짜</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">새 시간</Label>
                <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenChange(false)}>
              취소
            </Button>
            <Button onClick={() => submit("change")} disabled={submitting}>
              신청
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
