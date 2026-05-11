export const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS === "true";

export type DevRole = "admin" | "trainer" | "member";

const STORAGE_KEY = "dev-role";
const EVENT = "dev-role-change";

export function getDevRole(): DevRole {
  if (typeof window === "undefined") return "admin";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "trainer" || v === "member" || v === "admin" ? v : "admin";
}

export function setDevRole(role: DevRole) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, role);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: role }));
}

export function onDevRoleChange(cb: (role: DevRole) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb(((e as CustomEvent).detail as DevRole) ?? getDevRole());
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
