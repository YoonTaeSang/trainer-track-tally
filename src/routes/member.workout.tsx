import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/member/workout")({
  component: () => (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <Activity className="h-8 w-8 text-muted-foreground" />
        <p className="text-base font-semibold">운동</p>
        <p className="text-sm text-muted-foreground">개인 운동 프로그램이 곧 제공됩니다.</p>
      </CardContent>
    </Card>
  ),
  head: () => ({ meta: [{ title: "운동 | PT Studio" }] }),
});
