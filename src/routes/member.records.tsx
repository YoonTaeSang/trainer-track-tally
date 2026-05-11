import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useSchedules } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/member/records")({
  component: MemberRecords,
  head: () => ({ meta: [{ title: "기록 | PT Studio" }] }),
});

function MemberRecords() {
  const { user } = useAuth();
  const [members] = useMembers();
  const [schedules] = useSchedules();
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfileName(data?.name ?? ""));
  }, [user]);

  const myMember = useMemo(() => {
    if (!profileName) return members[0];
    return members.find((m) => m.name === profileName) ?? members[0];
  }, [members, profileName]);

  const records = useMemo(() => {
    if (!myMember) return [];
    return schedules
      .filter((s) => s.memberId === myMember.id && s.attended !== null)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [schedules, myMember]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">출석 기록</CardTitle>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 기록이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {records.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">{s.date}</p>
                  <p className="text-xs text-muted-foreground">{s.time}</p>
                </div>
                <Badge variant={s.attended ? "default" : "destructive"}>
                  {s.attended ? "출석" : "결석"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
