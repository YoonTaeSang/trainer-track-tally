import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/member/booking")({
  component: () => (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground" />
        <p className="text-base font-semibold">예약</p>
        <p className="text-sm text-muted-foreground">PT 예약 기능이 곧 제공됩니다.</p>
      </CardContent>
    </Card>
  ),
  head: () => ({ meta: [{ title: "예약 | PT Studio" }] }),
});
