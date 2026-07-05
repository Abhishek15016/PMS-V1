"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Radar,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Skeleton, StatCard, cn } from "@pms/ui";
import type { RecruiterSummaryResponse, Role, SummaryResponse, YoyResponse } from "@pms/types";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useAuthStore } from "@/lib/auth/auth-store";
import {
  useFilterOptions,
  useSummary,
  useUpcomingDrives,
  useYoy,
} from "@/lib/analytics/use-analytics";
import { useOffers } from "@/lib/offers/use-offers";
import { useCompanies } from "@/lib/companies/use-companies";
import { CompanyLogo } from "@/components/company-logo";
import { StudentHome } from "@/components/student-home";

const QUICK_LINKS: Array<{
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}> = [
  {
    label: "Students",
    description: "Browse cohort profiles and placement status",
    href: "/students",
    icon: GraduationCap,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT"],
  },
  {
    label: "Companies & Drives",
    description: "Manage recruiters, job descriptions, and drives",
    href: "/companies",
    icon: Building2,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
  },
  {
    label: "Policy & Eligibility",
    description: "Author eligibility, slab, and offer-cap rules",
    href: "/policy",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN", "TPO"],
  },
  {
    label: "Applications",
    description: "Track applications and round progression",
    href: "/applications",
    icon: ClipboardList,
    roles: ["TPO", "FACULTY_COORD", "STUDENT"],
  },
  {
    label: "Offers",
    description: "Extend, approve, and track offer decisions",
    href: "/offers",
    icon: Award,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
  },
  {
    label: "Report Studio",
    description: "NIRF/NAAC-ready placement report, one click",
    href: "/reports",
    icon: FileCheck2,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD"],
  },
  {
    label: "Analytics",
    description: "Placement funnel, branch breakdown, and YoY trends",
    href: "/analytics",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
  },
];

const FUNNEL_STAGES: Array<{ label: string; field: keyof SummaryResponse }> = [
  { label: "Eligible", field: "eligibleCount" },
  { label: "Applied", field: "appliedCount" },
  { label: "Shortlisted", field: "shortlistedCount" },
  { label: "Selected", field: "selectedCount" },
  { label: "Placed", field: "placedCount" },
];

interface Signal {
  tone: "good" | "warning" | "serious";
  title: string;
  detail: string;
  href: string;
}

/** Heuristic insights computed client-side from data the API already returns —
 * no model, no extra endpoints, and every number is traceable to the summary. */
function deriveSignals(summary: SummaryResponse, yoy: YoyResponse | undefined): Signal[] {
  const signals: Signal[] = [];

  const notApplied = summary.eligibleCount - summary.appliedCount;
  if (notApplied > 0) {
    signals.push({
      tone: "warning",
      title: `${notApplied} eligible student${notApplied === 1 ? "" : "s"} haven't applied anywhere`,
      detail: "Eligible but zero applications — the earliest fixable leak in the funnel.",
      href: "/students",
    });
  }

  let worstDrop = 0;
  let worstStage = "";
  for (let i = 1; i < FUNNEL_STAGES.length; i++) {
    const from = summary[FUNNEL_STAGES[i - 1]!.field] as number;
    const to = summary[FUNNEL_STAGES[i]!.field] as number;
    if (from > 0) {
      const drop = (from - to) / from;
      if (drop > worstDrop) {
        worstDrop = drop;
        worstStage = `${FUNNEL_STAGES[i - 1]!.label} → ${FUNNEL_STAGES[i]!.label}`;
      }
    }
  }
  if (worstDrop > 0.4 && worstStage) {
    signals.push({
      tone: "serious",
      title: `Biggest funnel leak: ${worstStage}`,
      detail: `${(worstDrop * 100).toFixed(0)}% of students drop at this stage — worth a targeted intervention.`,
      href: "/analytics",
    });
  }

  if (yoy?.placementPercentDelta != null) {
    if (yoy.placementPercentDelta >= 0) {
      signals.push({
        tone: "good",
        title: `Placement rate up ${yoy.placementPercentDelta.toFixed(1)} pts YoY`,
        detail: "Ahead of last season at the same computation point.",
        href: "/analytics",
      });
    } else {
      signals.push({
        tone: "warning",
        title: `Placement rate trailing last year by ${Math.abs(yoy.placementPercentDelta).toFixed(1)} pts`,
        detail: "Compare branch-wise numbers to find where the gap is coming from.",
        href: "/analytics",
      });
    }
  }

  if (summary.unplacedCount > 0 && summary.activeDriveCount === 0) {
    signals.push({
      tone: "serious",
      title: `${summary.unplacedCount} unplaced students and no active drives`,
      detail: "The pipeline is empty — line up the next set of companies.",
      href: "/companies",
    });
  }

  if (signals.length === 0) {
    signals.push({
      tone: "good",
      title: "No red flags in the current season",
      detail: "Funnel conversion and YoY trends look healthy.",
      href: "/analytics",
    });
  }
  return signals;
}

const SIGNAL_STYLES: Record<Signal["tone"], { icon: React.ComponentType<{ className?: string }>; chip: string }> = {
  good: { icon: CheckCircle2, chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  warning: { icon: AlertTriangle, chip: "bg-amber-50 text-amber-700 border-amber-200" },
  serious: { icon: TrendingDown, chip: "bg-rose-50 text-rose-700 border-rose-200" },
};

function formatPercent(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}
function formatCtc(v: number | null | undefined): string {
  return v == null ? "—" : `₹${v.toFixed(1)}L`;
}

function FunnelCard({ summary }: { summary: SummaryResponse }) {
  const max = Math.max(summary.eligibleCount, 1);
  return (
    <Card className="lg:col-span-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Season funnel</h2>
        <Link href="/analytics" className="text-xs font-medium text-brand-600 hover:text-brand-700">
          Full analytics →
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {FUNNEL_STAGES.map((stage, i) => {
          const value = summary[stage.field] as number;
          const prevValue = i > 0 ? (summary[FUNNEL_STAGES[i - 1]!.field] as number) : null;
          // Placed can exceed Selected (PPOs never pass through an application),
          // so a >100% "conversion" is meaningless — show nothing instead.
          const conversion =
            prevValue != null && prevValue > 0 && value <= prevValue
              ? `${((value / prevValue) * 100).toFixed(0)}%`
              : null;
          return (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-neutral-500">{stage.label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded-r-[4px] bg-neutral-100">
                <div
                  className="animate-grow-bar h-full rounded-r-[4px] bg-gradient-brand"
                  style={{ width: `${(value / max) * 100}%`, animationDelay: `${i * 100}ms` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs font-semibold text-neutral-900">{value}</span>
              <span className="hidden w-12 shrink-0 text-right text-[11px] text-neutral-400 sm:block">
                {conversion ?? ""}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SignalsCard({ summary, yoy }: { summary: SummaryResponse; yoy: YoyResponse | undefined }) {
  const signals = deriveSignals(summary, yoy);
  return (
    <Card className="lg:col-span-2">
      <div className="flex items-center gap-2">
        <Radar className="h-4 w-4 text-brand-500" />
        <h2 className="text-sm font-semibold text-neutral-900">Placement intelligence</h2>
        <Badge tone="brand">Live</Badge>
      </div>
      <ul className="mt-4 space-y-3">
        {signals.slice(0, 4).map((signal) => {
          const { icon: Icon, chip } = SIGNAL_STYLES[signal.tone];
          return (
            <li key={signal.title}>
              <Link
                href={signal.href}
                className="group flex items-start gap-3 rounded-[var(--radius-md)] border border-neutral-100 p-3 transition-colors hover:border-neutral-200 hover:bg-neutral-50"
              >
                <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", chip)}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-neutral-900">{signal.title}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">{signal.detail}</span>
                </span>
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Ranked live from accepted offers — new companies rise automatically as offers land. */
function TopRecruitersCard() {
  const offers = useOffers();
  const companies = useCompanies();

  const top = (() => {
    if (!offers.data || !companies.data) return [];
    const byCompany = new Map<string, { accepted: number; topCtc: number }>();
    for (const o of offers.data) {
      if (o.status !== "ACCEPTED" || !o.application) continue;
      const companyId = o.application.drive.jobDescription.companyId;
      const entry = byCompany.get(companyId) ?? { accepted: 0, topCtc: 0 };
      entry.accepted += 1;
      entry.topCtc = Math.max(entry.topCtc, o.ctcLpa);
      byCompany.set(companyId, entry);
    }
    return [...byCompany.entries()]
      .map(([id, agg]) => ({ company: companies.data!.find((c) => c.id === id), ...agg }))
      .filter((e): e is typeof e & { company: NonNullable<(typeof e)["company"]> } => !!e.company)
      .sort((a, b) => b.accepted - a.accepted || b.topCtc - a.topCtc)
      .slice(0, 5);
  })();

  if (offers.isError || companies.isError) return null;

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-brand-500" />
        <h2 className="text-sm font-semibold text-neutral-900">Top recruiters</h2>
      </div>
      {offers.isLoading || companies.isLoading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : top.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {top.map(({ company, accepted, topCtc }, i) => (
            <li key={company.id}>
              <Link
                href={`/companies/${company.id}`}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-100 p-2.5 transition-colors hover:border-neutral-200 hover:bg-neutral-50"
              >
                <span className="w-4 text-center text-xs font-bold text-neutral-300">{i + 1}</span>
                <CompanyLogo name={company.name} website={company.website} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">{company.name}</span>
                  <span className="block text-xs text-neutral-500">
                    {accepted} accepted · up to ₹{topCtc}L
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">Rankings appear as offers get accepted.</p>
      )}
    </Card>
  );
}

function UpcomingDrivesCard() {
  const upcoming = useUpcomingDrives();
  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-brand-500" />
        <h2 className="text-sm font-semibold text-neutral-900">Upcoming drives</h2>
      </div>
      {upcoming.isLoading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : upcoming.data && upcoming.data.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {upcoming.data.slice(0, 4).map((d) => (
            <li key={d.id} className="rounded-[var(--radius-md)] border border-neutral-100 p-2.5">
              <p className="truncate text-sm font-medium text-neutral-900">{d.jdTitle}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {d.companyName} ·{" "}
                {d.scheduledAt
                  ? new Date(d.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                  : "unscheduled"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">No drives scheduled yet.</p>
      )}
    </Card>
  );
}

export default function DashboardOverviewPage() {
  const me = useCurrentUser();
  const storedUser = useAuthStore((s) => s.user);
  const role = me.data?.role ?? storedUser?.role;
  const displayName = storedUser?.displayName;

  const isStaff = role === "SUPER_ADMIN" || role === "TPO" || role === "FACULTY_COORD";
  const filterOptions = useFilterOptions(isStaff);
  const latestBatchId = filterOptions.data?.batches[0]?.id;
  const summary = useSummary(
    { batchId: isStaff ? latestBatchId : undefined },
    isStaff ? !!latestBatchId : true,
  );
  const yoy = useYoy({ batchId: latestBatchId }, isStaff && !!latestBatchId);

  const staffData =
    summary.data && "totalStudents" in summary.data ? (summary.data as SummaryResponse) : undefined;
  const recruiterData =
    summary.data && "offersAccepted" in summary.data
      ? (summary.data as RecruiterSummaryResponse)
      : undefined;

  const visibleLinks = role ? QUICK_LINKS.filter((l) => l.roles.includes(role)) : QUICK_LINKS;
  const isLoadingSummary = isStaff ? filterOptions.isLoading || summary.isLoading : summary.isLoading;

  // Students get a fully personalized home instead of the staff snapshot.
  if (role === "STUDENT") {
    return <StudentHome displayName={displayName ?? ""} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-neutral-200/80 bg-white p-8 shadow-[var(--shadow-sm)]">
        <div
          className="animate-float-slow pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-[0.18] blur-[90px]"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        />
        <div
          className="animate-float-slower pointer-events-none absolute -bottom-16 left-1/4 h-48 w-48 rounded-full bg-sky-400 opacity-[0.10] blur-[80px]"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-dot-pattern opacity-[0.5] [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
        <div className="relative">
          <PageHeader
            title={`Welcome${displayName ? `, ${displayName.split(" ")[0]}` : ""}`}
            description="Here's a snapshot of your placement season."
          />
        </div>
      </div>

      {isLoadingSummary ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[var(--radius-xl)]" />
          ))}
        </div>
      ) : staffData ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Placement rate"
              value={formatPercent(staffData.placementPercent)}
              icon={<TrendingUp className="h-4 w-4" />}
              tone="brand"
            />
            <StatCard label="Placed" value={staffData.placedCount} icon={<Users className="h-4 w-4" />} />
            <StatCard label="Median CTC" value={formatCtc(staffData.medianCtc)} icon={<Award className="h-4 w-4" />} />
            <StatCard
              label="Active drives"
              value={staffData.activeDriveCount}
              icon={<Building2 className="h-4 w-4" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <FunnelCard summary={staffData} />
            <SignalsCard summary={staffData} yoy={yoy.data} />
          </div>
        </>
      ) : recruiterData ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Pending" value={recruiterData.offersPending} />
          <StatCard label="Extended" value={recruiterData.offersExtended} />
          <StatCard label="Accepted" value={recruiterData.offersAccepted} icon={<Award className="h-4 w-4" />} tone="brand" />
          <StatCard label="Rejected" value={recruiterData.offersRejected} />
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No placement summary yet"
            description="Once eligibility and offers start flowing, this snapshot will populate automatically."
          />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={isStaff ? "lg:col-span-2" : "lg:col-span-3"}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Quick access</h2>
          <div className={cn("mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2", !isStaff && "lg:grid-cols-3")}>
            {visibleLinks.map(({ label, description, href, icon: Icon }) => (
              <Link key={href} href={href}>
                <Card interactive className="group h-full">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-white shadow-[var(--shadow-sm)] transition-transform duration-200 group-hover:scale-105"
                      style={{ background: "var(--gradient-brand)" }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900">{label}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
                    </div>
                    <span className="text-neutral-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-500">
                      →
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
        {isStaff && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">This week</h2>
            <UpcomingDrivesCard />
            <TopRecruitersCard />
          </div>
        )}
      </div>
    </div>
  );
}
