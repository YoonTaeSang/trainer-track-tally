export const BODY_PARTS = ["가슴", "등", "어깨", "하체", "복근", "팔"] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

export const DIFFICULTIES = ["초급", "중급", "고급"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export function difficultyVariant(d: string): "secondary" | "default" | "destructive" {
  if (d === "초급") return "secondary";
  if (d === "중급") return "default";
  return "destructive";
}

function getYoutubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1);
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/");
      const idx = parts.indexOf("embed");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
  } catch {
    return null;
  }
  return null;
}

export function getYoutubeThumbnailUrl(url: string | null | undefined): string | null {
  const videoId = getYoutubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
}

export function getYoutubeEmbedUrl(url: string | null | undefined): string | null {
  const videoId = getYoutubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}
