import { supabase } from "@/integrations/supabase/client";

export type Availability = {
  id: string;
  trainer_id: string;
  weekday: number; // 0 = Sun ... 6 = Sat
  start_time: string; // "HH:MM"
  end_time: string;
};

export type TimeOff = {
  id: string;
  trainer_id: string;
  date: string; // YYYY-MM-DD
  reason: string;
};

export const SLOT_MINUTES = 30;

export function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Generate 30-min slots between start..end (end exclusive). */
export function expandSlots(start: string, end: string): string[] {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  const out: string[] = [];
  for (let t = s; t + SLOT_MINUTES <= e; t += SLOT_MINUTES) out.push(minutesToTime(t));
  return out;
}

/** All possible slots for a trainer on a given date, accounting for time-off. */
export function slotsFor(
  trainerId: string,
  date: string,
  availability: Availability[],
  timeOff: TimeOff[]
): string[] {
  const off = timeOff.find((t) => t.trainer_id === trainerId && t.date === date);
  if (off) return [];
  const d = new Date(`${date}T00:00:00`);
  const wd = d.getDay();
  const rows = availability.filter((a) => a.trainer_id === trainerId && a.weekday === wd);
  const all = new Set<string>();
  rows.forEach((r) => expandSlots(r.start_time, r.end_time).forEach((s) => all.add(s)));
  return Array.from(all).sort();
}

export async function fetchAvailability(trainerId?: string) {
  let q = (supabase as any).from("trainer_availability").select("*");
  if (trainerId) q = q.eq("trainer_id", trainerId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Availability[];
}

export async function fetchTimeOff(trainerId?: string) {
  let q = (supabase as any).from("trainer_time_off").select("*");
  if (trainerId) q = q.eq("trainer_id", trainerId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TimeOff[];
}

export const WEEK_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;
