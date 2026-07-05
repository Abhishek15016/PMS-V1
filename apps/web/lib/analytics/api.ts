import type {
  DrilldownMetric,
  DrilldownOfferRow,
  DrilldownStudentRow,
  FilterOptionsResponse,
  RecruiterSummaryResponse,
  SummaryResponse,
  UpcomingDriveRow,
  YoyResponse,
} from "@pms/types";
import { apiFetch } from "../api-client";

export type SummaryQuery = {
  batchId?: string;
  departmentId?: string;
};

function toQueryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] != null && entry[1] !== "",
  );
  if (entries.length === 0) return "";
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

export function fetchSummary(
  query: SummaryQuery,
): Promise<SummaryResponse | RecruiterSummaryResponse> {
  return apiFetch(`/analytics/summary${toQueryString(query)}`);
}

export function fetchYoy(query: SummaryQuery): Promise<YoyResponse> {
  return apiFetch(`/analytics/yoy${toQueryString(query)}`);
}

export function fetchDrilldown(
  query: SummaryQuery & { metric: DrilldownMetric },
): Promise<DrilldownStudentRow[] | DrilldownOfferRow[]> {
  return apiFetch(`/analytics/drilldown${toQueryString(query)}`);
}

export function fetchFilterOptions(): Promise<FilterOptionsResponse> {
  return apiFetch("/analytics/filter-options");
}

export function fetchUpcomingDrives(): Promise<UpcomingDriveRow[]> {
  return apiFetch("/analytics/upcoming-drives");
}
