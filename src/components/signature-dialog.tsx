import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSchedules, type Schedule } from "@/lib/store";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schedule: Schedule | null;
  memberName: string;
  trainerName: string;
};

export function SignatureDialog({ open, onOpenChange, schedule, memberName, trainerName }: Props) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [, setSchedules] = useSchedules();
  const [saving, setSaving] = useState(false);

  const dataUrlToBlob = (dataUrl: string) => {
    const [header, base64] = dataUrl.split(",");
    const mime = /data:(.*?);base64/.exec(header)?.[1] ?? "image/png";
    const bin = atob(base64);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  const handleSave = async () => {
    if (!schedule) return;
    if (padRef.current?.isEmpty()) {
      toast.error("서명을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const dataUrl = padRef.current?.toDataURL() ?? "";
      const blob = dataUrlToBlob(dataUrl);
      const path = `${schedule.id}/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("signatures")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("signatures").getPublicUrl(path);
      const url = pub.publicUrl;

      setSchedules((prev) =>
        prev.map((s) =>
          s.id === schedule.id
            ? { ...s, signatureUrl: url, signedAt: new Date().toISOString() }
            : s
        )
      );
      toast.success("서명이 저장되었습니다.");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("서명 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>PT 완료 확인 서명</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted/40 p-3 text-xs">
            <p>날짜: <span className="font-medium">{schedule?.date} {schedule?.time}</span></p>
            <p>트레이너: <span className="font-medium">{trainerName}</span></p>
            <p>회원: <span className="font-medium">{memberName}</span></p>
          </div>
          <p className="text-sm font-medium">
            "PT 수업을 완료하였음을 확인합니다"
          </p>
          <div className="flex justify-center">
            <SignaturePad ref={padRef} width={320} height={180} />
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            손가락 또는 마우스로 위 영역에 서명해주세요.
          </p>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => padRef.current?.clear()}
            disabled={saving}
          >
            다시 쓰기
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "저장 중..." : "서명 완료"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
