"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Award,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartHandshake,
  MapPin,
  PartyPopper,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  Badge,
  BadgeTone,
  Button,
  Card,
  PageHeader,
  Skeleton,
  StatCard,
  cn,
  useToast,
} from "@pms/ui";
import type {
  Application,
  ApplicationStatus,
  Company,
  Drive,
  Student,
  SummaryResponse,
} from "@pms/types";
import { useStudents } from "@/lib/students/use-students";
import { useApplications, useCreateApplication } from "@/lib/applications/use-applications";
import { useOffers } from "@/lib/offers/use-offers";
import { useDrives } from "@/lib/drives/use-drives";
import { useCompanies } from "@/lib/companies/use-companies";
import { useSummary } from "@/lib/analytics/use-analytics";
import { cgpaNumber, profileStrength } from "@/lib/students/profile-strength";
import { CompanyLogo } from "@/components/company-logo";

const APP_STATUS_TONE: Record<ApplicationStatus, BadgeTone> = {
  APPLIED: "neutral",
  SHORTLISTED: "info",
  IN_ROUND: "warning",
  SELECTED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

interface DriveFit {
  drive: Drive;
  company: Company | undefined;
  eligible: boolean;
  reason: string | null; // why not eligible; null when eligible
  alreadyApplied: boolean;
}

/** Client-side preview of the same rules the eligibility engine enforces server-side — the API remains the source of truth on apply. */
function assessFit(drive: Drive, me: Student, appliedDriveIds: Set<string>): Omit<DriveFit, "company"> {
  const alreadyApplied = appliedDriveIds.has(drive.id);
  const jd = drive.jobDescription;
  const criteria = (jd.minCriteria ?? {}) as { minCgpa?: number; maxActiveBacklogs?: number };

  if (jd.eligiblePrograms.length > 0 && !jd.eligiblePrograms.includes(me.department.code)) {
    return { drive, eligible: false, reason: `Not open to ${me.department.code}`, alreadyApplied };
  }
  if (typeof criteria.minCgpa === "number" && cgpaNumber(me) < criteria.minCgpa) {
    return { drive, eligible: false, reason: `Needs CGPA ≥ ${criteria.minCgpa} (you: ${cgpaNumber(me).toFixed(2)})`, alreadyApplied };
  }
  if (typeof criteria.maxActiveBacklogs === "number" && me.activeBacklogs > criteria.maxActiveBacklogs) {
    return { drive, eligible: false, reason: `Allows ≤ ${criteria.maxActiveBacklogs} active backlogs (you: ${me.activeBacklogs})`, alreadyApplied };
  }
  return { drive, eligible: true, reason: null, alreadyApplied };
}

function OpenDriveCard({ fit, onApplied }: { fit: DriveFit; onApplied: () => void }) {
  const createApplication = useCreateApplication();
  const { show } = useToast();
  const jd = fit.drive.jobDescription;

  async function quickApply() {
    try {
      await createApplication.mutateAsync({ driveId: fit.drive.id });
      show({ tone: "success", title: "Application submitted", description: jd.title });
      onApplied();
    } catch {
      show({
        tone: "danger",
        title: "Couldn't apply",
        description: "The eligibility engine declined this application — check with your placement cell.",
      });
    }
  }

  return (
    <div className="flex items-center gap-3.5 rounded-[var(--radius-lg)] border border-neutral-100 p-3.5 transition-colors hover:border-neutral-200">
      <CompanyLogo name={fit.company?.name ?? "Company"} website={fit.company?.website} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-900">
          {fit.company ? `${fit.company.name} — ` : ""}
          {jd.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-neutral-500">
          <span className="font-bold text-neutral-900">₹{jd.ctcLpa}L</span>
          {jd.location && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {jd.location}
            </span>
          )}
          <Badge tone={fit.drive.status === "ONGOING" ? "warning" : "info"}>{fit.drive.status}</Badge>
          {fit.drive.scheduledAt && (
            <span className="inline-flex items-center gap-0.5">
              <CalendarDays className="h-3 w-3" />
              {new Date(fit.drive.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
        <p className={cn("mt-1 flex items-center gap-1 text-xs", fit.eligible ? "text-emerald-600" : "text-neutral-400")}>
          {fit.eligible ? (
            <>
              <CheckCircle2 className="h-3 w-3" /> You meet the posted criteria
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" /> {fit.reason}
            </>
          )}
        </p>
      </div>
      {fit.alreadyApplied ? (
        <Badge tone="success" dot>
          Applied
        </Badge>
      ) : (
        <Button
          size="sm"
          variant={fit.eligible ? "primary" : "secondary"}
          disabled={!fit.eligible || createApplication.isPending}
          onClick={quickApply}
        >
          {createApplication.isPending ? "Applying…" : "Apply"}
        </Button>
      )}
    </div>
  );
}

export function StudentHome({ displayName }: { displayName: string }) {
  const students = useStudents();
  const applications = useApplications();
  const offers = useOffers();
  const drives = useDrives();
  const companies = useCompanies();
  const cohort = useSummary({});

  const me = students.data?.[0];

  const companyById = useMemo(() => {
    const map = new Map<string, Company>();
    for (const c of companies.data ?? []) map.set(c.id, c);
    return map;
  }, [companies.data]);

  const appliedDriveIds = useMemo(
    () => new Set((applications.data ?? []).map((a) => a.driveId)),
    [applications.data],
  );

  const acceptedOffer = useMemo(
    () => (offers.data ?? []).find((o) => o.status === "ACCEPTED"),
    [offers.data],
  );
  const pendingOffers = useMemo(
    () => (offers.data ?? []).filter((o) => o.status === "EXTENDED"),
    [offers.data],
  );

  const openDriveFits = useMemo<DriveFit[]>(() => {
    if (!me || !drives.data) return [];
    return drives.data
      .filter((d) => d.status === "SCHEDULED" || d.status === "ONGOING")
      .map((d) => ({
        ...assessFit(d, me, appliedDriveIds),
        company: companyById.get(d.jobDescription.companyId),
      }))
      .sort(
        (a, b) =>
          Number(b.eligible) - Number(a.eligible) ||
          Number(a.alreadyApplied) - Number(b.alreadyApplied) ||
          b.drive.jobDescription.ctcLpa - a.drive.jobDescription.ctcLpa,
      );
  }, [me, drives.data, appliedDriveIds, companyById]);

  const inProgress = (applications.data ?? []).filter(
    (a) => a.status === "SHORTLISTED" || a.status === "IN_ROUND",
  ).length;

  const cohortData =
    cohort.data && "totalStudents" in cohort.data ? (cohort.data as SummaryResponse) : undefined;

  const strength = me ? profileStrength(me) : null;
  const acceptedCompany =
    acceptedOffer?.application &&
    companyById.get(acceptedOffer.application.drive.jobDescription.companyId);

  const isLoading = students.isLoading || applications.isLoading || offers.isLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-neutral-200/80 bg-white p-8 shadow-[var(--shadow-sm)]">
        <div
          className="animate-float-slow pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-[0.18] blur-[90px]"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-dot-pattern opacity-[0.5] [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <PageHeader
              title={`Welcome, ${displayName.split(" ")[0]}`}
              description={
                acceptedOffer
                  ? "Congratulations on your offer — here's your season at a glance."
                  : "Your placement season, personalized."
              }
            />
            {acceptedOffer ? (
              <div className="mt-4 inline-flex items-center gap-3 rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-4 py-3">
                <PartyPopper className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    Placed{acceptedCompany ? ` at ${acceptedCompany.name}` : ""} · ₹{acceptedOffer.ctcLpa}L
                    {acceptedOffer.isPpo ? " (PPO)" : ""}
                  </p>
                  <p className="text-xs text-emerald-700">
                    {acceptedOffer.slab ? `${acceptedOffer.slab.replace("_", " ")} slab · ` : ""}
                    accepted{" "}
                    {acceptedOffer.respondedAt
                      ? new Date(acceptedOffer.respondedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })
                      : ""}
                  </p>
                </div>
              </div>
            ) : pendingOffers.length > 0 ? (
              <Link
                href="/offers"
                className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-100"
              >
                <Award className="h-4 w-4" />
                {pendingOffers.length} offer{pendingOffers.length === 1 ? "" : "s"} waiting for your decision →
              </Link>
            ) : null}
          </div>

          {me && strength && (
            <div className="w-full max-w-64 rounded-[var(--radius-lg)] border border-neutral-100 bg-neutral-50/60 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-600">Profile strength</span>
                <span className="font-bold text-neutral-900">{strength.score}/100</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200/70">
                <div
                  className={cn(
                    "h-full rounded-full",
                    strength.score >= 80 ? "bg-emerald-500" : strength.score >= 60 ? "bg-brand-500" : "bg-amber-500",
                  )}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                {strength.label} · CGPA {cgpaNumber(me).toFixed(2)} · {me.activeBacklogs} active backlog
                {me.activeBacklogs === 1 ? "" : "s"}
                {!me.resumeUrl && " · add a resume to gain 10 pts"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[var(--radius-xl)]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="My applications"
            value={applications.data?.length ?? 0}
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <StatCard label="In progress" value={inProgress} icon={<TrendingUp className="h-4 w-4" />} tone="brand" />
          <StatCard label="Offers" value={offers.data?.length ?? 0} icon={<Award className="h-4 w-4" />} />
          <StatCard
            label="Cohort placement"
            value={cohortData?.placementPercent != null ? `${cohortData.placementPercent.toFixed(1)}%` : "—"}
            icon={<BadgeCheck className="h-4 w-4" />}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ── Open drives ── */}
        <Card className="lg:col-span-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-semibold text-neutral-900">Open drives for you</h2>
            {openDriveFits.length > 0 && (
              <Badge tone="brand">{openDriveFits.filter((f) => f.eligible && !f.alreadyApplied).length} you can apply to</Badge>
            )}
          </div>
          {drives.isLoading || students.isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : openDriveFits.length > 0 ? (
            <div className="mt-3 space-y-2.5">
              {openDriveFits.slice(0, 6).map((fit) => (
                <OpenDriveCard key={fit.drive.id} fit={fit} onApplied={() => applications.refetch()} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              No open drives right now — new ones appear here the moment your placement cell schedules them.
            </p>
          )}
        </Card>

        {/* ── My pipeline ── */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold text-neutral-900">My pipeline</h2>
            </div>
            <Link href="/applications" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              All applications →
            </Link>
          </div>
          {applications.isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (applications.data?.length ?? 0) > 0 ? (
            <ul className="mt-3 space-y-2">
              {[...applications.data!]
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .slice(0, 5)
                .map((a: Application) => {
                  const company = companyById.get(a.drive.jobDescription.companyId);
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-neutral-100 p-2.5"
                    >
                      <CompanyLogo name={company?.name ?? "Drive"} website={company?.website} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-neutral-900">
                          {company ? `${company.name} — ` : ""}
                          {a.drive.jobDescription.title}
                        </p>
                        <p className="text-[11px] text-neutral-400">₹{a.drive.jobDescription.ctcLpa}L</p>
                      </div>
                      <Badge tone={APP_STATUS_TONE[a.status]} dot>
                        {a.status.replace("_", " ")}
                      </Badge>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              You haven&apos;t applied anywhere yet — start with an open drive on the left.
            </p>
          )}
        </Card>
      </div>

      {/* ── Career tools ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/resume">
          <Card interactive className="group h-full">
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-white shadow-[var(--shadow-sm)] transition-transform duration-200 group-hover:scale-105"
                style={{ background: "var(--gradient-brand)" }}
              >
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">Resume Studio</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Build, score against real drives (ATS), export a print-perfect PDF
                </p>
              </div>
              <span className="text-neutral-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-500">
                →
              </span>
            </div>
          </Card>
        </Link>
        <Link href="/mentors">
          <Card interactive className="group h-full">
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-white shadow-[var(--shadow-sm)] transition-transform duration-200 group-hover:scale-105"
                style={{ background: "var(--gradient-brand)" }}
              >
                <HeartHandshake className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">Mentor Connect</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Ask placed seniors company-specific questions on the Q&amp;A board
                </p>
              </div>
              <span className="text-neutral-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-500">
                →
              </span>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
