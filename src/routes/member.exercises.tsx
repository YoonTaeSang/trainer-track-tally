import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BODY_PARTS, difficultyVariant, getYoutubeThumbnailUrl } from "@/lib/exercises";

export const Route = createFileRoute("/member/exercises")({
  component: ExercisesPage,
  head: () => ({ meta: [{ title: "운동 라이브러리 | PT Studio" }] }),
});

type Exercise = {
  id: string;
  name: string;
  body_part: string;
  difficulty: string;
  thumbnail_url: string | null;
  youtube_url: string | null;
};

const TABS = ["전체", ...BODY_PARTS] as const;

function ExercisesPage() {
  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("전체");

  useEffect(() => {
    supabase
      .from("exercises")
      .select("id, name, body_part, difficulty, thumbnail_url, youtube_url")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as Exercise[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return items.filter((e) => {
      if (tab !== "전체" && e.body_part !== tab) return false;
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, tab, search]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="운동 이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-1.5 pb-1">
          {TABS.map((t) => {
            const active = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          조건에 맞는 운동이 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => e.youtube_url && window.open(e.youtube_url, '_blank')}
              disabled={!e.youtube_url}
              className="block cursor-pointer text-left disabled:cursor-default"
            >
              <Card className="overflow-hidden transition hover:border-primary/50 disabled:hover:border-border">
                <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">
                  {e.thumbnail_url ? (
                    <img
                      src={e.thumbnail_url}
                      alt={e.name}
                      className="h-full w-full object-cover"
                    />
                  ) : e.youtube_url && getYoutubeThumbnailUrl(e.youtube_url) ? (
                    <img
                      src={getYoutubeThumbnailUrl(e.youtube_url)!}
                      alt={e.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Dumbbell className="h-8 w-8 opacity-40" />
                  )}
                </div>
                <CardContent className="space-y-1.5 p-3">
                  <p className="line-clamp-1 text-sm font-semibold">{e.name}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={difficultyVariant(e.difficulty)} className="text-[10px]">
                      {e.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {e.body_part}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
