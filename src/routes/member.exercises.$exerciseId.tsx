import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Heart, Dumbbell, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { difficultyVariant, getYoutubeThumbnailUrl } from "@/lib/exercises";

export const Route = createFileRoute("/member/exercises/$exerciseId")({
  component: ExerciseDetailPage,
  head: () => ({ meta: [{ title: "운동 상세 | PT Studio" }] }),
});

type Exercise = {
  id: string;
  name: string;
  body_part: string;
  difficulty: string;
  description: string;
  youtube_url: string | null;
  thumbnail_url: string | null;
};

function ExerciseDetailPage() {
  const { exerciseId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("exercises")
      .select("*")
      .eq("id", exerciseId)
      .maybeSingle()
      .then(({ data }) => {
        setItem((data as Exercise | null) ?? null);
        setLoading(false);
      });
  }, [exerciseId]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("exercise_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("exercise_id", exerciseId)
      .maybeSingle()
      .then(({ data }) => setFavorite(!!data));
  }, [user, exerciseId]);

  const toggleFavorite = async () => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    setFavLoading(true);
    if (favorite) {
      const { error } = await supabase
        .from("exercise_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("exercise_id", exerciseId);
      if (error) toast.error("즐겨찾기 해제 실패");
      else {
        setFavorite(false);
        toast.success("즐겨찾기에서 제거되었습니다.");
      }
    } else {
      const { error } = await supabase
        .from("exercise_favorites")
        .insert({ user_id: user.id, exercise_id: exerciseId });
      if (error) toast.error("즐겨찾기 추가 실패");
      else {
        setFavorite(true);
        toast.success("즐겨찾기에 추가되었습니다.");
      }
    }
    setFavLoading(false);
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</p>;
  }

  if (!item) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">운동을 찾을 수 없습니다.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/member/exercises" })}>
          목록으로
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/member/exercises">
            <ChevronLeft className="mr-1 h-4 w-4" />
            목록
          </Link>
        </Button>
        <Button
          variant={favorite ? "default" : "outline"}
          size="sm"
          onClick={toggleFavorite}
          disabled={favLoading}
        >
          <Heart className={`mr-1 h-4 w-4 ${favorite ? "fill-current" : ""}`} />
          {favorite ? "즐겨찾기 해제" : "즐겨찾기"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-muted">
        {item.youtube_url ? (
          <button
            className="relative w-full aspect-video overflow-hidden hover:brightness-90 transition-all"
            onClick={() => window.open(item.youtube_url!, '_blank')}
          >
            <img
              src={getYoutubeThumbnailUrl(item.youtube_url)!}
              alt={item.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-black/50">
                <Play className="w-8 h-8 text-white fill-white" />
              </div>
            </div>
          </button>
        ) : item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt={item.name} className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center text-muted-foreground">
            <Dumbbell className="h-10 w-10 opacity-40" />
          </div>
        )}
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight">{item.name}</h1>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge variant={difficultyVariant(item.difficulty)}>{item.difficulty}</Badge>
          <Badge variant="outline">{item.body_part}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-1.5 pt-4">
          <p className="text-xs font-semibold text-muted-foreground">설명 · 자세 · 주의사항</p>
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {item.description || "등록된 설명이 없습니다."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
