import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { refetchAllTables } from "@/lib/store";

/** Refetches all store-managed tables whenever the pathname changes. */
export function useRouteRefresh() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  useEffect(() => {
    refetchAllTables();
  }, [pathname]);
}
