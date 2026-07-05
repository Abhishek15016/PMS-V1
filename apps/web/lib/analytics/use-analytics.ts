import { useQueries, useQuery } from "@tanstack/react-query";
import type { DrilldownMetric } from "@pms/types";
import { useAuthStore } from "../auth/auth-store";
import {
  fetchDrilldown,
  fetchFilterOptions,
  fetchSummary,
  fetchUpcomingDrives,
  fetchYoy,
  SummaryQuery,
} from "./api";

function useReady() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  return hasHydrated && !!accessToken;
}

export function useSummary(query: SummaryQuery, enabled = true) {
  const ready = useReady();
  return useQuery({
    queryKey: ["analytics", "summary", query],
    queryFn: () => fetchSummary(query),
    enabled: ready && enabled,
    retry: false,
    // Refetch periodically so the dashboard reflects new activity without a manual reload.
    refetchInterval: 30_000,
  });
}

export function useYoy(query: SummaryQuery, enabled = true) {
  const ready = useReady();
  return useQuery({
    queryKey: ["analytics", "yoy", query],
    queryFn: () => fetchYoy(query),
    enabled: ready && enabled,
    retry: false,
  });
}

export function useDrilldown(
  query: SummaryQuery & { metric: DrilldownMetric | null },
) {
  const ready = useReady();
  return useQuery({
    queryKey: ["analytics", "drilldown", query],
    queryFn: () => fetchDrilldown({ ...query, metric: query.metric! }),
    enabled: ready && !!query.metric && !!query.batchId,
    retry: false,
  });
}

export function useFilterOptions(enabled = true) {
  const ready = useReady();
  return useQuery({
    queryKey: ["analytics", "filter-options"],
    queryFn: fetchFilterOptions,
    enabled: ready && enabled,
    retry: false,
  });
}

export function useUpcomingDrives(enabled = true) {
  const ready = useReady();
  return useQuery({
    queryKey: ["analytics", "upcoming-drives"],
    queryFn: fetchUpcomingDrives,
    enabled: ready && enabled,
    retry: false,
  });
}

/**
 * The branch table needs one summary per department, but the department
 * list is dynamic (fetched from the API) — calling useSummary() in a .map()
 * would violate the rules of hooks as soon as the list changes length
 * between renders. useQueries() is react-query's purpose-built escape
 * hatch for exactly this "N queries where N varies" shape.
 */
export function useBranchSummaries(
  batchId: string | null,
  departmentIds: string[],
) {
  const ready = useReady();
  return useQueries({
    queries: departmentIds.map((departmentId) => ({
      queryKey: ["analytics", "summary", { batchId, departmentId }],
      queryFn: () => fetchSummary({ batchId: batchId ?? undefined, departmentId }),
      enabled: ready && !!batchId,
      retry: false,
    })),
  });
}
