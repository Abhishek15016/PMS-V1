"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Award, Building2, Percent, TrendingUp, Users } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Label,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  cn,
} from "@pms/ui";
import type {
  DrilldownMetric,
  DrilldownOfferRow,
  DrilldownStudentRow,
  SummaryResponse,
  YoyResponse,
} from "@pms/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { ApiError } from "@/lib/api-client";
import { useFilters } from "@/lib/analytics/use-filters";
import {
  useBranchSummaries,
  useDrilldown,
  useFilterOptions,
  useSummary,
  useUpcomingDrives,
  useYoy,
} from "@/lib/analytics/use-analytics";

const BRAND_COLOR = "#4f46e5";

const FUNNEL_STAGES: Array<{
  key: DrilldownMetric;
  label: string;
  field: "eligibleCount" | "appliedCount" | "shortlistedCount" | "selectedCount" | "placedCount";
}> = [
  { key: "eligible", label: "Eligible", field: "eligibleCount" },
  { key: "applied", label: "Applied", field: "appliedCount" },
  { key: "shortlisted", label: "Shortlisted", field: "shortlistedCount" },
  { key: "selected", label: "Selected", field: "selectedCount" },
  { key: "placed", label: "Placed", field: "placedCount" },
];

function formatCtc(v: number | null | undefined): string {
  return v == null ? "—" : `₹${v.toFixed(1)}L`;
}
function formatPercent(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}
function isStale(computedAt: string): boolean {
  return Date.now() - new Date(computedAt).getTime() > 10 * 60 * 1000;
}

export default function AnalyticsPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === "RECRUITER") return <RecruiterAnalytics />;
  if (role === "STUDENT") return <StudentAnalytics />;
  return <StaffAnalytics />;
}

function DeltaHint({ delta, suffix }: { delta?: number | null; suffix: string }) {
  if (delta == null) return null;
  return (
    <span className={cn("font-medium", delta >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
      {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
      {suffix} YoY
    </span>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-[var(--radius-lg)]" />
      ))}
    </div>
  );
}

function KpiStrip({ summary, yoy }: { summary: SummaryResponse; yoy?: YoyResponse }) {
  const stale = isStale(summary.computedAt);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-900">Key metrics</h2>
        <Badge tone={stale ? "warning" : "success"} dot>
          {stale ? "Stale" : "Live"} · computed {new Date(summary.computedAt).toLocaleTimeString()}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Placement %"
          value={formatPercent(summary.placementPercent)}
          icon={<Percent className="h-4 w-4" />}
          tone="brand"
          hint={<DeltaHint delta={yoy?.placementPercentDelta} suffix="pts" />}
        />
        <StatCard label="Placed" value={summary.placedCount} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Unplaced" value={summary.unplacedCount} />
        <StatCard label="Highest CTC" value={formatCtc(summary.highestCtc)} icon={<Award className="h-4 w-4" />} />
        <StatCard
          label="Median CTC"
          value={formatCtc(summary.medianCtc)}
          hint={<DeltaHint delta={yoy?.medianCtcDelta} suffix="L" />}
        />
        <StatCard label="Average CTC" value={formatCtc(summary.averageCtc)} />
        <StatCard label="Active drives" value={summary.activeDriveCount} icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Recruiters" value={summary.recruiterCount} icon={<TrendingUp className="h-4 w-4" />} />
      </div>
    </div>
  );
}

function FunnelSection({
  summary,
  onSelect,
}: {
  summary: SummaryResponse;
  onSelect: (metric: DrilldownMetric) => void;
}) {
  const data = FUNNEL_STAGES.map((s) => ({
    name: s.label,
    value: summary[s.field],
    key: s.key,
  }));

  return (
    <Card>
      <h2 className="text-sm font-medium text-neutral-900">Funnel</h2>
      <p className="mt-1 text-xs text-neutral-500">Click a stage to see the underlying list.</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={90} />
            <Tooltip />
            <Bar
              dataKey="value"
              fill={BRAND_COLOR}
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(data: unknown) => {
                const point = data as { key?: DrilldownMetric };
                if (point.key) onSelect(point.key);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function BranchTable({
  batchId,
  departments,
}: {
  batchId: string;
  departments: Array<{ id: string; code: string; name: string }>;
}) {
  const results = useBranchSummaries(
    batchId,
    departments.map((d) => d.id),
  );

  return (
    <Card>
      <h2 className="text-sm font-medium text-neutral-900">Branch breakdown</h2>
      {results.some((r) => r.isLoading) ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <div className="mt-3">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Branch</TableHeaderCell>
                <TableHeaderCell>Placed</TableHeaderCell>
                <TableHeaderCell>Total</TableHeaderCell>
                <TableHeaderCell>Placement %</TableHeaderCell>
                <TableHeaderCell>Median CTC</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {departments.map((dept, i) => {
                const result = results[i];
                const data = result?.data as SummaryResponse | undefined;
                if (!data || !("totalStudents" in data)) {
                  return (
                    <TableRow key={dept.id}>
                      <TableCell>{dept.name}</TableCell>
                      <TableCell colSpan={4} className="text-neutral-400">
                        No data yet
                      </TableCell>
                    </TableRow>
                  );
                }
                const pct = data.placementPercent;
                return (
                  <TableRow key={dept.id} interactive>
                    <TableCell className="font-medium text-neutral-900">{dept.name}</TableCell>
                    <TableCell>{data.placedCount}</TableCell>
                    <TableCell>{data.totalStudents}</TableCell>
                    <TableCell>
                      <span
                        className="inline-block rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor:
                            pct == null ? undefined : `rgba(79, 70, 229, ${Math.min(pct / 100, 1) * 0.5 + 0.1})`,
                        }}
                      >
                        {formatPercent(pct)}
                      </span>
                    </TableCell>
                    <TableCell>{formatCtc(data.medianCtc)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function RightRail() {
  const upcoming = useUpcomingDrives();
  return (
    <Card>
      <h2 className="text-sm font-medium text-neutral-900">Upcoming drives</h2>
      {upcoming.isLoading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : upcoming.isError ? (
        <p className="mt-3 text-sm text-[var(--color-danger)]">Couldn&apos;t load upcoming drives.</p>
      ) : upcoming.data && upcoming.data.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm">
          {upcoming.data.map((d) => (
            <li key={d.id} className="rounded-[var(--radius-sm)] border border-neutral-100 p-2">
              <p className="font-medium text-neutral-900">{d.jdTitle}</p>
              <p className="text-xs text-neutral-500">
                {d.companyName} ·{" "}
                {d.scheduledAt ? new Date(d.scheduledAt).toLocaleDateString() : "unscheduled"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">No upcoming drives.</p>
      )}
    </Card>
  );
}

function DrilldownDrawer({
  metric,
  batchId,
  departmentId,
  onClose,
}: {
  metric: DrilldownMetric;
  batchId: string;
  departmentId?: string;
  onClose: () => void;
}) {
  const drilldown = useDrilldown({ batchId, departmentId, metric });
  const rows = drilldown.data;
  const isOfferRows = rows && rows.length > 0 && "ctcLpa" in rows[0]!;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/20"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${metric} drilldown`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold capitalize text-neutral-900">
            {metric.replace("-", " ")}
          </h2>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-2">
          <Button variant="secondary" disabled title="Export lands in a later release">
            Export
          </Button>
        </div>
        <div className="mt-4">
          {drilldown.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : drilldown.isError ? (
            <p className="text-sm text-[var(--color-danger)]">Couldn&apos;t load this list.</p>
          ) : rows && rows.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  {isOfferRows ? (
                    <>
                      <TableHeaderCell>Student</TableHeaderCell>
                      <TableHeaderCell>CTC</TableHeaderCell>
                      <TableHeaderCell>Slab</TableHeaderCell>
                    </>
                  ) : (
                    <>
                      <TableHeaderCell>Roll number</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {isOfferRows
                  ? (rows as DrilldownOfferRow[]).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.studentId}</TableCell>
                        <TableCell>₹{row.ctcLpa}L</TableCell>
                        <TableCell>{row.slab ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  : (rows as DrilldownStudentRow[]).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.rollNumber ?? row.id}</TableCell>
                        <TableCell>{row.placementStatus}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="No records for this metric" />
          )}
        </div>
      </div>
    </div>
  );
}

function StaffAnalytics() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const isFull = role === "TPO" || role === "SUPER_ADMIN";
  const { batchId, departmentId, setBatchId, setDepartmentId } = useFilters();
  const filterOptions = useFilterOptions();
  const [drilldownMetric, setDrilldownMetric] = useState<DrilldownMetric | null>(null);

  useEffect(() => {
    if (!batchId && filterOptions.data?.batches.length) {
      setBatchId(filterOptions.data.batches[0]!.id);
    }
  }, [batchId, filterOptions.data, setBatchId]);

  const summaryQuery = {
    batchId: batchId ?? undefined,
    departmentId: isFull ? (departmentId ?? undefined) : undefined,
  };
  const summary = useSummary(summaryQuery, !!batchId);
  const yoy = useYoy(summaryQuery, !!batchId);

  useEffect(() => {
    if (summary.isError && summary.error instanceof ApiError && summary.error.status === 403) {
      router.replace("/forbidden?resource=analytics.view");
    }
  }, [summary.isError, summary.error, router]);

  const summaryData =
    summary.data && "totalStudents" in summary.data ? (summary.data as SummaryResponse) : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Placement Analytics"
        description="The one view: placement %, funnel, branch breakdown, and upcoming drives."
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="batch-select">Batch</Label>
            <Select
              id="batch-select"
              className="mt-1 w-56"
              value={batchId ?? ""}
              onChange={(e) => setBatchId(e.target.value || null)}
            >
              <option value="" disabled>
                Select a batch
              </option>
              {filterOptions.data?.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </Select>
          </div>
          {isFull && (
            <div>
              <Label htmlFor="dept-select">Department</Label>
              <Select
                id="dept-select"
                className="mt-1 w-56"
                value={departmentId ?? ""}
                onChange={(e) => setDepartmentId(e.target.value || null)}
              >
                <option value="">All departments</option>
                {filterOptions.data?.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </Card>

      {!batchId ? (
        <Card>
          <EmptyState title="Pick a batch to see analytics" />
        </Card>
      ) : summary.isLoading ? (
        <KpiSkeleton />
      ) : summary.isError ? (
        summary.error instanceof ApiError && summary.error.status === 404 ? (
          <Card>
            <EmptyState title="No placement summary computed yet" description="Check back once eligibility and offers start flowing for this batch/department." />
          </Card>
        ) : summary.error instanceof ApiError && summary.error.status === 403 ? null : (
          <Card>
            <p className="text-sm text-[var(--color-danger)]">
              Couldn&apos;t load analytics. Try again in a moment.
            </p>
          </Card>
        )
      ) : summaryData ? (
        <>
          <KpiStrip summary={summaryData} yoy={yoy.data} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <FunnelSection summary={summaryData} onSelect={setDrilldownMetric} />
              {isFull && !departmentId && (
                <BranchTable batchId={batchId} departments={filterOptions.data?.departments ?? []} />
              )}
            </div>
            <RightRail />
          </div>
        </>
      ) : null}

      {drilldownMetric && batchId && (
        <DrilldownDrawer
          metric={drilldownMetric}
          batchId={batchId}
          departmentId={isFull ? (departmentId ?? undefined) : undefined}
          onClose={() => setDrilldownMetric(null)}
        />
      )}
    </div>
  );
}

function RecruiterAnalytics() {
  const summary = useSummary({});
  const data =
    summary.data && "offersAccepted" in summary.data ? summary.data : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Your offers" description="Offer activity for your company across every drive." />
      {summary.isLoading ? (
        <KpiSkeleton />
      ) : data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Pending" value={data.offersPending} />
          <StatCard label="Extended" value={data.offersExtended} icon={<Percent className="h-4 w-4" />} />
          <StatCard label="Accepted" value={data.offersAccepted} icon={<Award className="h-4 w-4" />} tone="brand" />
          <StatCard label="Rejected" value={data.offersRejected} />
        </div>
      ) : (
        <Card>
          <EmptyState title="Couldn't load your offer stats" />
        </Card>
      )}
    </div>
  );
}

function StudentAnalytics() {
  const summary = useSummary({});
  const data =
    summary.data && "totalStudents" in summary.data ? (summary.data as SummaryResponse) : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Your cohort's placement stats" description="Aggregate numbers for your batch and department." />
      {summary.isLoading ? (
        <KpiSkeleton />
      ) : data ? (
        <KpiStrip summary={data} />
      ) : (
        <Card>
          <EmptyState title="No placement summary available yet" />
        </Card>
      )}
    </div>
  );
}
