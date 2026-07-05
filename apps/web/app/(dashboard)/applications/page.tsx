"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Search } from "lucide-react";
import {
  Badge,
  BadgeTone,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  useToast,
} from "@pms/ui";
import type { Application, ApplicationStatus, Company, RoundResultStatus } from "@pms/types";
import { CompanyLogo } from "@/components/company-logo";
import { cn } from "@pms/ui";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useCompanies } from "@/lib/companies/use-companies";
import { useDrive, useDrives } from "@/lib/drives/use-drives";
import {
  useApplications,
  useCreateApplication,
  useRecordRoundResult,
  useShortlistApplication,
  useWithdrawApplication,
} from "@/lib/applications/use-applications";
import { useStudents } from "@/lib/students/use-students";
import { ApiError } from "@/lib/api-client";

const STATUS_TONE: Record<ApplicationStatus, BadgeTone> = {
  APPLIED: "neutral",
  SHORTLISTED: "info",
  IN_ROUND: "warning",
  SELECTED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

const TERMINAL_STATUSES: ApplicationStatus[] = ["SELECTED", "REJECTED", "WITHDRAWN"];

const PIPELINE_ORDER: ApplicationStatus[] = [
  "APPLIED",
  "SHORTLISTED",
  "IN_ROUND",
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
];

export default function ApplicationsPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const applications = useApplications();
  const companies = useCompanies();
  const canApply = role === "STUDENT" || role === "TPO" || role === "FACULTY_COORD";
  const isTpo = role === "TPO" || role === "SUPER_ADMIN";

  useEffect(() => {
    if (
      applications.isError &&
      applications.error instanceof ApiError &&
      applications.error.status === 403
    ) {
      router.replace("/forbidden?resource=applications.apply");
    }
  }, [applications.isError, applications.error, router]);

  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "">("");
  const [query, setQuery] = useState("");

  const companyById = useMemo(() => {
    const map = new Map<string, Company>();
    for (const c of companies.data ?? []) map.set(c.id, c);
    return map;
  }, [companies.data]);

  const statusCounts = useMemo(() => {
    const counts = new Map<ApplicationStatus, number>();
    for (const a of applications.data ?? []) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
    return counts;
  }, [applications.data]);

  const rows = useMemo(() => {
    let list = applications.data ?? [];
    if (statusFilter) list = list.filter((a) => a.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const companyName = companyById.get(a.drive.jobDescription.companyId)?.name ?? "";
        return (
          a.drive.jobDescription.title.toLowerCase().includes(q) ||
          companyName.toLowerCase().includes(q) ||
          (a.student.rollNumber ?? "").toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [applications.data, statusFilter, query, companyById]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Applications"
        description="Apply to drives, track round progression, and shortlist candidates."
        actions={
          canApply && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Apply
            </Button>
          )
        }
      />

      <ApplyDialog open={showForm} onClose={() => setShowForm(false)} />

      {(applications.data?.length ?? 0) > 0 && (
        <Card>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === ""
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
              )}
            >
              All · {applications.data?.length ?? 0}
            </button>
            {PIPELINE_ORDER.map((s) => {
              const count = statusCounts.get(s) ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === s
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                  )}
                >
                  {s.replace("_", " ")} · {count}
                </button>
              );
            })}
            <div className="relative ml-auto min-w-44">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                className="h-9 pl-8 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Company, role, or roll no…"
                aria-label="Search applications"
              />
            </div>
          </div>
        </Card>
      )}

      <Card className="p-0">
        {applications.isLoading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : applications.isError ? (
          applications.error instanceof ApiError && applications.error.status === 403 ? null : (
            <p className="p-6 text-sm text-[var(--color-danger)]">
              Couldn&apos;t load applications. Try again in a moment.
            </p>
          )
        ) : rows.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {rows.map((application) => (
              <ApplicationRow
                key={application.id}
                application={application}
                isTpo={isTpo}
                company={companyById.get(application.drive.jobDescription.companyId)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title={statusFilter || query ? "No applications match" : "No applications yet"}
            description={
              statusFilter || query
                ? "Try clearing the search or status filter."
                : canApply
                  ? "Apply to an open drive to get started."
                  : undefined
            }
            action={
              canApply &&
              !(statusFilter || query) && (
                <Button variant="secondary" onClick={() => setShowForm(true)}>
                  + Apply
                </Button>
              )
            }
          />
        )}
      </Card>
    </div>
  );
}

function ApplyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const role = useAuthStore((s) => s.user?.role);
  const createApplication = useCreateApplication();
  const { show } = useToast();
  const drives = useDrives();
  const companies = useCompanies();
  const students = useStudents();
  const [driveId, setDriveId] = useState("");
  const [studentId, setStudentId] = useState("");
  const showStudentPicker = role === "TPO" || role === "FACULTY_COORD";

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    companies.data?.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [companies.data]);

  // Students apply only to drives that are actually open; staff keep the full
  // list (they sometimes backfill applications onto completed drives).
  const pickableDrives = useMemo(() => {
    const all = drives.data ?? [];
    return role === "STUDENT"
      ? all.filter((d) => d.status === "SCHEDULED" || d.status === "ONGOING")
      : all;
  }, [drives.data, role]);

  function reset() {
    setDriveId("");
    setStudentId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createApplication.mutateAsync({
        driveId,
        studentId: showStudentPicker && studentId ? studentId : undefined,
      });
      show({ tone: "success", title: "Application submitted" });
      reset();
      onClose();
    } catch {
      show({
        tone: "danger",
        title: "Couldn't submit this application",
        description: "Check eligibility, debar status, and drive status.",
      });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Apply to a drive">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="driveId">Drive</Label>
          <Select id="driveId" value={driveId} onChange={(e) => setDriveId(e.target.value)} required>
            <option value="" disabled>
              {drives.isLoading
                ? "Loading drives…"
                : pickableDrives.length === 0
                  ? "No open drives right now"
                  : "Select a drive"}
            </option>
            {pickableDrives.map((d) => (
              <option key={d.id} value={d.id}>
                {companyNameById.get(d.jobDescription.companyId) ?? "Unknown company"} — {d.jobDescription.title} (₹
                {d.jobDescription.ctcLpa} LPA) · {d.status}
              </option>
            ))}
          </Select>
        </div>
        {showStudentPicker && (
          <div>
            <Label htmlFor="studentId">Student (on behalf of)</Label>
            <Select id="studentId" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Applying for myself</option>
              {students.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.rollNumber ?? s.user.displayName} · {s.department.code}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createApplication.isPending || !driveId}>
            {createApplication.isPending ? "Applying…" : "Apply"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ApplicationRow({
  application,
  isTpo,
  company,
}: {
  application: Application;
  isTpo: boolean;
  company: Company | undefined;
}) {
  const withdraw = useWithdrawApplication();
  const shortlist = useShortlistApplication();
  const { show } = useToast();
  const [showRoundForm, setShowRoundForm] = useState(false);
  const canWithdraw = !TERMINAL_STATUSES.includes(application.status);
  const canShortlist = isTpo && application.status === "APPLIED";

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CompanyLogo name={company?.name ?? "Drive"} website={company?.website} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900">
              {company ? `${company.name} — ` : ""}
              {application.drive.jobDescription.title}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {application.student.rollNumber ?? application.studentId} · ₹
              {application.drive.jobDescription.ctcLpa} LPA · applied{" "}
              {new Date(application.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
        <Badge tone={STATUS_TONE[application.status]} dot>
          {application.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {canWithdraw && (
          <Button
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={withdraw.isPending}
            onClick={() =>
              withdraw.mutate(application.id, {
                onSuccess: () => show({ tone: "success", title: "Application withdrawn" }),
                onError: () => show({ tone: "danger", title: "Couldn't withdraw application" }),
              })
            }
          >
            Withdraw
          </Button>
        )}
        {canShortlist && (
          <Button
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={shortlist.isPending}
            onClick={() =>
              shortlist.mutate(application.id, {
                onSuccess: () => show({ tone: "success", title: "Application shortlisted" }),
                onError: () => show({ tone: "danger", title: "Couldn't shortlist application" }),
              })
            }
          >
            Shortlist
          </Button>
        )}
        {isTpo && (
          <Button
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setShowRoundForm((v) => !v)}
          >
            {showRoundForm ? "Cancel" : "Record round result"}
          </Button>
        )}
      </div>

      {showRoundForm && (
        <RoundResultForm
          applicationId={application.id}
          driveId={application.driveId}
          onDone={() => setShowRoundForm(false)}
        />
      )}

      {application.roundResults.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
          {application.roundResults.map((r, i) => (
            <li key={r.id} className="flex items-center gap-1.5">
              {i > 0 && <span className="h-px w-3 bg-neutral-200" aria-hidden />}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                  r.status === "PASS"
                    ? "bg-emerald-50 text-emerald-700"
                    : r.status === "FAIL"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-neutral-100 text-neutral-500",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    r.status === "PASS" ? "bg-emerald-500" : r.status === "FAIL" ? "bg-rose-500" : "bg-neutral-400",
                  )}
                />
                R{i + 1} {r.status}
                {r.score != null ? ` · ${r.score}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ROUND_RESULT_STATUSES: RoundResultStatus[] = ["PENDING", "PASS", "FAIL"];

function RoundResultForm({
  applicationId,
  driveId,
  onDone,
}: {
  applicationId: string;
  driveId: string;
  onDone: () => void;
}) {
  const drive = useDrive(driveId);
  const recordRoundResult = useRecordRoundResult(applicationId);
  const { show } = useToast();
  const [roundId, setRoundId] = useState("");
  const [status, setStatus] = useState<RoundResultStatus>("PASS");
  const [score, setScore] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await recordRoundResult.mutateAsync({
        roundId,
        status,
        score: score ? Number(score) : undefined,
      });
      show({ tone: "success", title: "Round result recorded" });
      onDone();
    } catch {
      show({ tone: "danger", title: "Couldn't record this result" });
    }
  }

  const rounds = drive.data ? [...drive.data.rounds].sort((a, b) => a.position - b.position) : [];

  return (
    <form className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3" onSubmit={handleSubmit}>
      <div>
        <Label htmlFor={`round-${applicationId}`}>Round</Label>
        <Select
          id={`round-${applicationId}`}
          value={roundId}
          onChange={(e) => setRoundId(e.target.value)}
          className="w-40"
          required
        >
          <option value="" disabled>
            {drive.isLoading ? "Loading…" : "Select a round"}
          </option>
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.position}. {r.type}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`status-${applicationId}`}>Result</Label>
        <Select
          id={`status-${applicationId}`}
          value={status}
          onChange={(e) => setStatus(e.target.value as RoundResultStatus)}
          className="w-28"
        >
          {ROUND_RESULT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`score-${applicationId}`}>Score</Label>
        <Input
          id={`score-${applicationId}`}
          type="number"
          className="w-20"
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={recordRoundResult.isPending || !roundId}>
        {recordRoundResult.isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
