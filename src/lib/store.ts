// Demo localStorage store for PT shop management
import { useEffect, useState, useCallback } from "react";

export type Member = {
  id: string;
  name: string;
  phone: string;
  joinedAt: string; // ISO date
  totalSessions: number; // 총 등록 세션
  usedSessions: number; // 사용한 세션
  memo?: string;
};

export type Schedule = {
  id: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  attended: boolean | null; // null=예정, true=출석, false=결석
};

const MEMBERS_KEY = "pt_members";
const SCHEDULES_KEY = "pt_schedules";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("pt-store-update", { detail: { key } }));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function useStore<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    setValue(read(key, fallback));
    const onUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ key: string }>;
      if (ce.detail?.key === key) setValue(read(key, fallback));
    };
    window.addEventListener("pt-store-update", onUpdate);
    return () => window.removeEventListener("pt-store-update", onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        write(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  return [value, update] as const;
}

export function useMembers() {
  return useStore<Member[]>(MEMBERS_KEY, []);
}

export function useSchedules() {
  return useStore<Schedule[]>(SCHEDULES_KEY, []);
}

export function seedDemoData() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MEMBERS_KEY)) return;

  const members: Member[] = [
    { id: uid(), name: "김민수", phone: "010-1234-5678", joinedAt: "2025-01-15", totalSessions: 30, usedSessions: 12 },
    { id: uid(), name: "이지은", phone: "010-2345-6789", joinedAt: "2025-03-02", totalSessions: 20, usedSessions: 8 },
    { id: uid(), name: "박서준", phone: "010-3456-7890", joinedAt: "2025-04-10", totalSessions: 50, usedSessions: 25 },
    { id: uid(), name: "최유나", phone: "010-4567-8901", joinedAt: "2025-05-01", totalSessions: 10, usedSessions: 3 },
  ];
  write(MEMBERS_KEY, members);

  const today = new Date();
  const schedules: Schedule[] = [];
  for (let i = -7; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const m = members[Math.floor(Math.random() * members.length)];
    schedules.push({
      id: uid(),
      memberId: m.id,
      date: dateStr,
      time: ["10:00", "14:00", "18:00", "20:00"][Math.floor(Math.random() * 4)],
      attended: i < 0 ? Math.random() > 0.2 : null,
    });
  }
  write(SCHEDULES_KEY, schedules);
}
