"use client";

import Link from "next/link";
import {
  Award,
  BarChart3,
  Building2,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, EmptyState, PageHeader, Skeleton, StatCard } from "@pms/ui";
import type { RecruiterSummaryResponse, Role, SummaryResponse } from "@pms/types";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useFilterOptions, useSummary } from "@/lib/analytics/use-analytics";

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
    label: "Analytics",
    description: "Placement funnel, branch breakdown, and YoY trends",
    href: "/analytics",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
  },
];

function formatPercent(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}
function formatCtc(v: number | null | undefined): string {
  return v == null ? "—" : `₹${v.toFixed(1)}L`;
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

  const staffData =
    summary.data && "totalStudents" in summary.data ? (summary.data as SummaryResponse) : undefined;
  const recruiterData =
    summary.data && "offersAccepted" in summary.data
      ? (summary.data as RecruiterSummaryResponse)
      : undefined;

  const visibleLinks = role ? QUICK_LINKS.filter((l) => l.roles.includes(role)) : QUICK_LINKS;
  const isLoadingSummary = isStaff ? filterOptions.isLoading || summary.isLoading : summary.isLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-neutral-200/80 bg-white p-8 shadow-[var(--shadow-sm)]">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-[0.10] blur-[90px]"
          style={{ background: "var(--gradient-brand)" }}
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Placement rate"
            value={formatPercent(staffData.placementPercent)}
            icon={<TrendingUp className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard label="Placed" value={staffData.placedCount} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Highest CTC" value={formatCtc(staffData.highestCtc)} icon={<Award className="h-4 w-4" />} />
          <StatCard
            label="Active drives"
            value={staffData.activeDriveCount}
            icon={<Building2 className="h-4 w-4" />}
          />
        </div>
      ) : recruiterData ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Pending" value={recruiterData.offersPending} />
          <StatCard label="Extended" value={recruiterData.offersExtended} />
          <StatCard label="Accepted" value={recruiterData.offersAccepted} icon={<Award className="h-4 w-4" />} tone="brand" />
          <StatCard label="Rejected" value={recruiterData.offersRejected} />
        </div>
      ) : role === "STUDENT" ? null : (
        <Card>
          <EmptyState
            title="No placement summary yet"
            description="Once eligibility and offers start flowing, this snapshot will populate automatically."
          />
        </Card>
      )}

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Quick access</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
