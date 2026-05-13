import { supabase } from "@/integrations/supabase/client";

export type Availability = {
  id: string;
  trainer_id: string;
  weekday: number; // 0 = Sun ... 6 = Sat
  start_time: string; // "HH:MM"
  end_time: string;
  /** NULL: 매주 반복 (weekday 기준). 값 있음: 그 날짜 전용 가용 시간대 */
  specific_date?: string | null;
};

export type TimeOff = {
  id: string;
  trainer_id: string;
  date: string; // YYYY-MM-DD
  reason: string;
  /** NULL: 그날 전체 예약 불가. 값 있음: 그 시간대만 예약 불가 */
  start_time?: string | null;
  end_time?: string | null;
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

/** All possible slots for a trainer on a given date, accounting for time-off.
 *  Considers both recurring weekly availability and specific_date one-offs,
 *  and removes slots blocked by whole-day or slot-level time-off. */
export function slotsFor(
  trainerId: string,
  date: string,
  availability: Availability[],
  timeOff: TimeOff[]
): string[] {
  // Whole-day time-off (start/end null) takes precedence
  const wholeOff = timeOff.find(
    (t) =>
      t.trainer_id === trainerId &&
      t.date === date &&
      !t.start_time &&
      !t.end_time
  );
  if (wholeOff) return [];

  const d = new Date(`${date}T00:00:00`);
  const wd = d.getDay();
  const rows = availability.filter(
    (a) =>
      a.trainer_id === trainerId &&
      ((a.specific_date == null && a.weekday === wd) || a.specific_date === date)
  );
  const all = new Set<string>();
  rows.forEach((r) => expandSlots(r.start_time, r.end_time).forEach((s) => all.add(s)));

  // Subtract slot-level time-off
  const slotOffs = timeOff.filter(
    (t) =>
      t.trainer_id === trainerId &&
      t.date === date &&
      t.start_time &&
      t.end_time
  );
  for (const off of slotOffs) {
    expandSlots(off.start_time as string, off.end_time as string).forEach((s) => all.delete(s));
  }

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

/** Send "new PT schedule" notification to a member by member id. */
export async function notifyMemberOfSchedule(memberId: string, date: string, time: string) {
  try {
    const { data: m } = await (supabase as any)
      .from("members")
      .select("user_id,name")
      .eq("id", memberId)
      .maybeSingle();
    const userId = m?.user_id;
    if (!userId) return;
    const [y, mo, d] = date.split("-").map(Number);
    await (supabase as any).from("notifications").insert({
      user_id: userId,
      type: "schedule_added",
      title: "새 PT 일정 등록",
      body: `다음 PT 일정이 등록되었습니다. ${mo}월 ${d}일 ${time}`,
    });
  } catch (e) {
    console.error("[notifyMemberOfSchedule]", e);
  }
}
