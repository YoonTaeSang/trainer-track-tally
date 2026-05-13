// Supabase-backed store with realtime sync.
// Public hook API stays compatible with the previous localStorage version:
//   const [items, setItems] = useMembers(); setItems(prev => ...);
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Trainer = {
  id: string;
  userId?: string | null;
  name: string;
  phone: string;
  memo?: string;
};

export type MemberStatus = "pending" | "active" | "inactive" | "rejected";

export type Member = {
  id: string;
  userId?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  joinedAt: string;
  totalSessions: number;
  usedSessions: number;
  trainerId?: string | null;
  memo?: string;
  status: MemberStatus;
  /** 대시보드 잔여 세션 알림에서 제외된 시각 (관리자가 X 클릭) */
  dismissedAt?: string | null;
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
    userId: r.user_id ?? null,
    name: r.name ?? "",
    phone: r.phone ?? "",
    memo: r.memo ?? "",
  }),
  toRow: (t: Trainer) => ({
    id: t.id,
    user_id: t.userId ?? null,
    name: t.name ?? "",
    phone: t.phone ?? "",
    memo: t.memo ?? "",
  }),
};

const mapMember = {
  fromRow: (r: any): Member => ({
    id: r.id,
    userId: r.user_id ?? null,
    name: r.name ?? "",
    phone: r.phone ?? "",
    email: r.email ?? null,
    joinedAt: r.joined_at ?? "",
    totalSessions: r.total_sessions ?? 0,
    usedSessions: r.used_sessions ?? 0,
    trainerId: r.trainer_id ?? null,
    memo: r.memo ?? "",
    status: (r.status ?? "active") as MemberStatus,
    dismissedAt: r.dismissed_at ?? null,
  }),
  toRow: (m: Member) => ({
    id: m.id,
    user_id: m.userId ?? null,
    name: m.name ?? "",
    phone: m.phone ?? "",
    email: m.email ?? null,
    joined_at: m.joinedAt || new Date().toISOString().slice(0, 10),
    total_sessions: m.totalSessions ?? 0,
    used_sessions: m.usedSessions ?? 0,
    trainer_id: m.trainerId ?? null,
    memo: m.memo ?? "",
    status: m.status ?? "active",
    dismissed_at: m.dismissedAt ?? null,
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
  error: Error | null;
  listeners: Set<(d: L[]) => void>;
  statusListeners: Set<() => void>;
  channel?: ReturnType<typeof supabase.channel>;
};
const caches = new Map<string, CacheEntry<any>>();

function getCache<L>(table: string): CacheEntry<L> {
  let c = caches.get(table) as CacheEntry<L> | undefined;
  if (!c) {
    c = { data: [], loaded: false, loading: false, error: null, listeners: new Set(), statusListeners: new Set() };
    caches.set(table, c);
  }
  return c;
}

function notify<L>(c: CacheEntry<L>) {
  c.listeners.forEach((fn) => fn(c.data));
}

function notifyStatus<L>(c: CacheEntry<L>) {
  c.statusListeners.forEach((fn) => fn());
}

async function refetch<L>(table: string, mapper: Mapper<L>) {
  const c = getCache<L>(table);
  if (c.loading) return;
  c.loading = true;
  c.error = null;
  notifyStatus(c);
  try {
    const { data, error } = await (supabase as any).from(table).select("*");
    if (error) {
      console.error(`[store:${table}] refetch error`, error);
      c.error = new Error(error.message ?? `Failed to load ${table}`);
      return;
    }
    c.data = (data ?? []).map(mapper.fromRow);
    c.loaded = true;
    notify(c);
  } catch (e: any) {
    console.error(`[store:${table}] refetch threw`, e);
    c.error = e instanceof Error ? e : new Error(String(e));
  } finally {
    c.loading = false;
    notifyStatus(c);
  }
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
      const sb = supabase as any;
      if (toDelete.length) {
        sb.from(table).delete().in("id", toDelete).then(({ error }: any) => {
          if (error) console.error(`[store:${table}] delete error`, error);
        });
      }
      if (toInsert.length) {
        sb.from(table)
          .insert(toInsert.map(mapper.toRow))
          .then(({ error }: any) => {
            if (error) console.error(`[store:${table}] insert error`, error);
          });
      }
      for (const item of toUpdate) {
        sb.from(table)
          .update(mapper.toRow(item))
          .eq("id", item.id)
          .then(({ error }: any) => {
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

/** Subscribe to load/error status of a store-managed table. */
export function useTableStatus(
  table: "trainers" | "trainers_public" | "members" | "schedules" | "workout_logs"
) {
  const c = getCache<any>(table);
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    c.statusListeners.add(fn);
    return () => {
      c.statusListeners.delete(fn);
    };
  }, [table]);
  return { loading: c.loading, loaded: c.loaded, error: c.error };
}

/**
 * Public-safe trainer projection (id, name only) for member-facing routes.
 * Reads from the `trainers_public` view, which excludes phone/memo.
 * Uses the shared cache + ensureSubscription so the channel stays alive
 * across page navigations and all components share the same data.
 */
const mapPublicTrainer = {
  fromRow: (r: any): Trainer => ({
    id: r.id,
    userId: r.user_id ?? null,
    name: r.name ?? "",
    phone: "",
    memo: "",
  }),
  toRow: (t: Trainer) => ({ id: t.id, user_id: t.userId ?? null, name: t.name ?? "" }),
};

export function usePublicTrainers(): readonly [Trainer[]] {
  const c = getCache<Trainer>("trainers_public");
  const [data, setLocal] = useState<Trainer[]>(c.data);

  useEffect(() => {
    const listener = (d: Trainer[]) => setLocal(d);
    c.listeners.add(listener);
    if (!c.loaded && !c.loading) {
      // trainers_public view — load once; realtime via trainers table
      c.loading = true;
      c.error = null;
      notifyStatus(c);
      (async () => {
        try {
          const { data: rows, error } = await (supabase as any)
            .from("trainers_public")
            .select("id,user_id,name,created_at");
          if (error) {
            console.error("[store:trainers_public] error", error);
            c.error = new Error(error.message ?? "Failed to load trainers_public");
            return;
          }
          c.data = (rows ?? []).map(mapPublicTrainer.fromRow);
          c.loaded = true;
          notify(c);
        } finally {
          c.loading = false;
          notifyStatus(c);
        }
      })();
    } else {
      setLocal(c.data);
    }
    // Subscribe to trainers table changes to keep the public view fresh
    if (!c.channel) {
      c.channel = supabase
        .channel("store:trainers_public")
        .on("postgres_changes", { event: "*", schema: "public", table: "trainers" }, async () => {
          const { data: rows, error } = await (supabase as any)
            .from("trainers_public")
            .select("id,user_id,name,created_at");
          if (error) return;
          c.data = (rows ?? []).map(mapPublicTrainer.fromRow);
          c.loaded = true;
          notify(c);
          notifyStatus(c);
        })
        .subscribe();
    }
    return () => {
      c.listeners.delete(listener);
    };
  }, []);

  return [data] as const;
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

const ALL_TABLES: Array<[string, Mapper<any>]> = [
  ["trainers", mapTrainer],
  ["members", mapMember],
  ["schedules", mapSchedule],
  ["workout_logs", mapWorkoutLog],
];

/** Force-refetch every store-managed table from Supabase. */
export function refetchAllTables() {
  ALL_TABLES.forEach(([t, m]) => refetch(t, m));
}

// Seed is now done by the SQL migration. Keep no-op for back-compat.
export function seedDemoData() {
  /* handled in DB migration */
}

