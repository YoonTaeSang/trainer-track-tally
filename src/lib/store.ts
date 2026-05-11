// Supabase-backed store with realtime sync.
// Public hook API stays compatible with the previous localStorage version:
//   const [items, setItems] = useMembers(); setItems(prev => ...);
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Trainer = {
  id: string;
  name: string;
  phone: string;
  memo?: string;
};

export type Member = {
  id: string;
  name: string;
  phone: string;
  joinedAt: string;
  totalSessions: number;
  usedSessions: number;
  trainerId?: string | null;
  memo?: string;
};

export type Schedule = {
  id: string;
  memberId: string;
  date: string;
  time: string;
  attended: boolean | null;
  signatureRequested?: boolean;
  signatureUrl?: string | null;
  signedAt?: string | null;
};

export type WorkoutEntry = {
  id: string;
  name: string;
  sets: number;
  weight: number;
  reps: number;
};

export type MemberMemo = {
  id: string;
  at: string;
  text: string;
};

export type WorkoutLog = {
  id: string;
  scheduleId: string;
  memberId: string;
  trainerMemo: string;
  exercises: WorkoutEntry[];
  memberMemos: MemberMemo[];
};

export function uid() {
  // Need real UUIDs because the columns are uuid.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (shouldn't happen in modern browsers/SSR runtime)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---- Mappers between DB rows and local shape ----

const mapTrainer = {
  fromRow: (r: any): Trainer => ({
    id: r.id,
    name: r.name ?? "",
    phone: r.phone ?? "",
    memo: r.memo ?? "",
  }),
  toRow: (t: Trainer) => ({
    id: t.id,
    name: t.name ?? "",
    phone: t.phone ?? "",
    memo: t.memo ?? "",
  }),
};

const mapMember = {
  fromRow: (r: any): Member => ({
    id: r.id,
    name: r.name ?? "",
    phone: r.phone ?? "",
    joinedAt: r.joined_at ?? "",
    totalSessions: r.total_sessions ?? 0,
    usedSessions: r.used_sessions ?? 0,
    trainerId: r.trainer_id ?? null,
    memo: r.memo ?? "",
  }),
  toRow: (m: Member) => ({
    id: m.id,
    name: m.name ?? "",
    phone: m.phone ?? "",
    joined_at: m.joinedAt || new Date().toISOString().slice(0, 10),
    total_sessions: m.totalSessions ?? 0,
    used_sessions: m.usedSessions ?? 0,
    trainer_id: m.trainerId ?? null,
    memo: m.memo ?? "",
  }),
};

const mapSchedule = {
  fromRow: (r: any): Schedule => ({
    id: r.id,
    memberId: r.member_id,
    date: r.date,
    time: r.time,
    attended: r.attended,
    signatureRequested: r.signature_requested ?? false,
    signatureUrl: r.signature_url ?? null,
    signedAt: r.signed_at ?? null,
  }),
  toRow: (s: Schedule) => ({
    id: s.id,
    member_id: s.memberId,
    date: s.date,
    time: s.time,
    attended: s.attended,
    signature_requested: s.signatureRequested ?? false,
    signature_url: s.signatureUrl ?? null,
    signed_at: s.signedAt ?? null,
  }),
};

const mapWorkoutLog = {
  fromRow: (r: any): WorkoutLog => ({
    id: r.id,
    scheduleId: r.schedule_id,
    memberId: r.member_id,
    trainerMemo: r.trainer_memo ?? "",
    exercises: (r.exercises ?? []) as WorkoutEntry[],
    memberMemos: (r.member_memos ?? []) as MemberMemo[],
  }),
  toRow: (l: WorkoutLog) => ({
    id: l.id,
    schedule_id: l.scheduleId,
    member_id: l.memberId,
    trainer_memo: l.trainerMemo ?? "",
    exercises: l.exercises ?? [],
    member_memos: l.memberMemos ?? [],
  }),
};

// ---- Generic Supabase-synced collection hook ----

type Mapper<L> = {
  fromRow: (r: any) => L;
  toRow: (l: L) => Record<string, any>;
};

// Per-table caches shared across hook instances so multiple components
// mounting useMembers() etc. share the same data and one realtime channel.
type CacheEntry<L> = {
  data: L[];
  loaded: boolean;
  loading: boolean;
  listeners: Set<(d: L[]) => void>;
  channel?: ReturnType<typeof supabase.channel>;
};
const caches = new Map<string, CacheEntry<any>>();

function getCache<L>(table: string): CacheEntry<L> {
  let c = caches.get(table) as CacheEntry<L> | undefined;
  if (!c) {
    c = { data: [], loaded: false, loading: false, listeners: new Set() };
    caches.set(table, c);
  }
  return c;
}

function notify<L>(c: CacheEntry<L>) {
  c.listeners.forEach((fn) => fn(c.data));
}

async function refetch<L>(table: string, mapper: Mapper<L>) {
  const c = getCache<L>(table);
  if (c.loading) return;
  c.loading = true;
  const { data, error } = await supabase.from(table).select("*");
  c.loading = false;
  if (error) {
    console.error(`[store:${table}] refetch error`, error);
    return;
  }
  c.data = (data ?? []).map(mapper.fromRow);
  c.loaded = true;
  notify(c);
}

function ensureSubscription<L>(table: string, mapper: Mapper<L>) {
  const c = getCache<L>(table);
  if (c.channel) return;
  c.channel = supabase
    .channel(`store:${table}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => refetch(table, mapper)
    )
    .subscribe();
}

function useSupabaseTable<L extends { id: string }>(
  table: string,
  mapper: Mapper<L>
) {
  const c = getCache<L>(table);
  const [data, setLocal] = useState<L[]>(c.data);
  const dataRef = useRef<L[]>(data);
  dataRef.current = data;

  useEffect(() => {
    const listener = (d: L[]) => setLocal(d);
    c.listeners.add(listener);
    if (!c.loaded) refetch(table, mapper);
    else setLocal(c.data);
    ensureSubscription(table, mapper);
    return () => {
      c.listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const update = useCallback(
    (next: L[] | ((prev: L[]) => L[])) => {
      const prev = c.data;
      const resolved =
        typeof next === "function" ? (next as (p: L[]) => L[])(prev) : next;
      // Optimistic local + cache update
      c.data = resolved;
      notify(c);

      const prevById = new Map(prev.map((x) => [x.id, x]));
      const nextById = new Map(resolved.map((x) => [x.id, x]));

      const toDelete: string[] = [];
      const toInsert: L[] = [];
      const toUpdate: L[] = [];

      for (const id of prevById.keys()) {
        if (!nextById.has(id)) toDelete.push(id);
      }
      for (const item of resolved) {
        const prevItem = prevById.get(item.id);
        if (!prevItem) toInsert.push(item);
        else if (JSON.stringify(prevItem) !== JSON.stringify(item))
          toUpdate.push(item);
      }

      // Fire async DB ops; realtime will reconcile.
      if (toDelete.length) {
        supabase
          .from(table)
          .delete()
          .in("id", toDelete)
          .then(({ error }) => {
            if (error) console.error(`[store:${table}] delete error`, error);
          });
      }
      if (toInsert.length) {
        supabase
          .from(table)
          .insert(toInsert.map(mapper.toRow))
          .then(({ error }) => {
            if (error) console.error(`[store:${table}] insert error`, error);
          });
      }
      for (const item of toUpdate) {
        supabase
          .from(table)
          .update(mapper.toRow(item))
          .eq("id", item.id)
          .then(({ error }) => {
            if (error) console.error(`[store:${table}] update error`, error);
          });
      }
    },
    [table, mapper]
  );

  return [data, update] as const;
}

export function useTrainers() {
  return useSupabaseTable<Trainer>("trainers", mapTrainer);
}
export function useMembers() {
  return useSupabaseTable<Member>("members", mapMember);
}
export function useSchedules() {
  return useSupabaseTable<Schedule>("schedules", mapSchedule);
}
export function useWorkoutLogs() {
  return useSupabaseTable<WorkoutLog>("workout_logs", mapWorkoutLog);
}

// Seed is now done by the SQL migration. Keep no-op for back-compat.
export function seedDemoData() {
  /* handled in DB migration */
}
