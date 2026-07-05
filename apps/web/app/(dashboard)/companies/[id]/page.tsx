"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Briefcase, CheckCircle2, ChevronRight, Globe, MapPin, Plus, Timer, XCircle } from "lucide-react";
import {
  Badge,
  BadgeTone,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Label,
  Select,
  Skeleton,
  useToast,
} from "@pms/ui";
import type { Drive, DriveStatus, JobDescription } from "@pms/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useCompany } from "@/lib/companies/use-companies";
import { CompanyLogo } from "@/components/company-logo";
import { useCreateJobDescription, useJobDescriptions } from "@/lib/job-descriptions/use-job-descriptions";
import {
  useCreateDrive,
  useCreateRound,
  useDriveEligibility,
  useDrives,
  useUpdateDriveStatus,
} from "@/lib/drives/use-drives";
import { ApiError } from "@/lib/api-client";

const STATUS_TONE: Record<DriveStatus, BadgeTone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  ONGOING: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const userCompanyId = useAuthStore((s) => s.user?.companyId);
  const company = useCompany(id);

  useEffect(() => {
    if (company.isError && company.error instanceof ApiError && company.error.status === 403) {
      router.replace("/forbidden?resource=companies.records");
    }
  }, [company.isError, company.error, router]);

  const canSeeJDs = role === "SUPER_ADMIN" || role === "TPO" || (role === "RECRUITER" && userCompanyId === id);
  const canCreateJD = canSeeJDs;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Companies
        </Link>
        {company.isLoading ? (
          <Skeleton className="mt-2 h-16 w-full max-w-md" />
        ) : company.data ? (
          <div className="mt-3 flex items-center gap-4">
            <CompanyLogo name={company.data.name} website={company.data.website} size="lg" />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
                {company.data.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                {company.data.sector && <span>{company.data.sector}</span>}
                {company.data.tier && (
                  <Badge tone="brand">{company.data.tier.replace("tier-", "Tier ")}</Badge>
                )}
                {company.data.website && (
                  <a
                    href={company.data.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {company.data.website.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {canSeeJDs && <JobDescriptionsSection companyId={id} canCreate={canCreateJD} />}
    </div>
  );
}

function JobDescriptionsSection({ companyId, canCreate }: { companyId: string; canCreate: boolean }) {
  const jds = useJobDescriptions(companyId);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Job descriptions</h2>
        {canCreate && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Post JD
          </Button>
        )}
      </div>

      <CreateJobDescriptionDialog companyId={companyId} open={showForm} onClose={() => setShowForm(false)} />

      {jds.isLoading ? (
        <Card>
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : jds.isError ? (
        <Card>
          <p className="text-sm text-[var(--color-danger)]">Couldn&apos;t load job descriptions.</p>
        </Card>
      ) : jds.data && jds.data.length > 0 ? (
        <div className="space-y-4">
          {jds.data.map((jd) => (
            <JobDescriptionCard key={jd.id} jd={jd} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Briefcase className="h-5 w-5" />}
            title="No job descriptions posted yet"
            description={canCreate ? "Post a JD to start scheduling drives against it." : undefined}
            action={
              canCreate && (
                <Button variant="secondary" onClick={() => setShowForm(true)}>
                  + Post JD
                </Button>
              )
            }
          />
        </Card>
      )}
    </div>
  );
}

function CreateJobDescriptionDialog({
  companyId,
  open,
  onClose,
}: {
  companyId: string;
  open: boolean;
  onClose: () => void;
}) {
  const createJd = useCreateJobDescription();
  const { show } = useToast();
  const [title, setTitle] = useState("");
  const [ctcLpa, setCtcLpa] = useState("");
  const [eligiblePrograms, setEligiblePrograms] = useState("");
  const [location, setLocation] = useState("");
  const [bondMonths, setBondMonths] = useState("");

  function reset() {
    setTitle("");
    setCtcLpa("");
    setEligiblePrograms("");
    setLocation("");
    setBondMonths("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createJd.mutateAsync({
        companyId,
        title,
        ctcLpa: Number(ctcLpa),
        eligiblePrograms: eligiblePrograms
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        minCriteria: {},
        location: location || undefined,
        bondMonths: bondMonths ? Number(bondMonths) : undefined,
      });
      show({ tone: "success", title: "Job description posted", description: title });
      reset();
      onClose();
    } catch {
      show({ tone: "danger", title: "Couldn't post the JD", description: "Check the fields and try again." });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Post a job description">
      <form className="grid grid-cols-2 gap-4" onSubmit={handleSubmit}>
        <div className="col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </div>
        <div>
          <Label htmlFor="ctcLpa">CTC (LPA)</Label>
          <Input
            id="ctcLpa"
            type="number"
            step="0.1"
            min="0"
            value={ctcLpa}
            onChange={(e) => setCtcLpa(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="bondMonths">Bond (months)</Label>
          <Input
            id="bondMonths"
            type="number"
            min="0"
            value={bondMonths}
            onChange={(e) => setBondMonths(e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="eligiblePrograms">Eligible programs (comma-separated)</Label>
          <Input
            id="eligiblePrograms"
            value={eligiblePrograms}
            onChange={(e) => setEligiblePrograms(e.target.value)}
            placeholder="CSE, ECE"
            required
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createJd.isPending}>
            {createJd.isPending ? "Saving…" : "Post JD"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const BREAKUP_LABELS: Record<string, string> = {
  fixedLpa: "Fixed",
  variableLpa: "Variable",
  esopsLpa: "ESOPs",
  joiningBonusLpa: "Joining bonus",
};

const SLAB_TONE: Record<string, BadgeTone> = {
  DREAM: "success",
  SUPER_DREAM: "brand",
  NON_DREAM: "neutral",
};

function CtcBreakupChips({ breakup }: { breakup: unknown }) {
  if (!breakup || typeof breakup !== "object") return null;
  const entries = Object.entries(breakup as Record<string, unknown>).filter(
    ([, v]) => typeof v === "number" && v > 0,
  );
  if (entries.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-600"
        >
          <span className="font-medium text-neutral-800">₹{value as number}L</span>
          {BREAKUP_LABELS[key] ?? key}
        </span>
      ))}
    </div>
  );
}

function JobDescriptionCard({ jd }: { jd: JobDescription }) {
  const role = useAuthStore((s) => s.user?.role);
  const canSeeDrives = role === "SUPER_ADMIN" || role === "TPO" || role === "FACULTY_COORD";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900">{jd.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
            <span className="text-base font-bold text-neutral-900">₹{jd.ctcLpa} LPA</span>
            {jd.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                {jd.location}
              </span>
            )}
            {jd.bondMonths != null && jd.bondMonths > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <Timer className="h-3.5 w-3.5" />
                {jd.bondMonths}-month bond
              </span>
            )}
          </div>
          <CtcBreakupChips breakup={jd.ctcBreakup} />
          {jd.eligiblePrograms.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {jd.eligiblePrograms.map((p) => (
                <span key={p} className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        {jd.slab && <Badge tone={SLAB_TONE[jd.slab] ?? "brand"}>{jd.slab.replace("_", " ")}</Badge>}
      </div>

      {canSeeDrives && <DrivesSection jdId={jd.id} />}
    </Card>
  );
}

function DrivesSection({ jdId }: { jdId: string }) {
  const role = useAuthStore((s) => s.user?.role);
  const drives = useDrives(jdId);
  const createDrive = useCreateDrive();
  const { show } = useToast();
  const canCreateDrive = role === "SUPER_ADMIN" || role === "TPO" || role === "FACULTY_COORD";

  async function handleCreateDrive() {
    try {
      await createDrive.mutateAsync({ jdId });
      show({ tone: "success", title: "Drive created" });
    } catch {
      show({ tone: "danger", title: "Couldn't create drive" });
    }
  }

  return (
    <div className="mt-4 border-t border-neutral-100 pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500">Drives</h4>
        {canCreateDrive && (
          <Button
            variant="secondary"
            className="h-8 px-3 text-xs"
            onClick={handleCreateDrive}
            disabled={createDrive.isPending}
          >
            {createDrive.isPending ? "Creating…" : "+ Create drive"}
          </Button>
        )}
      </div>

      {drives.isLoading ? (
        <Skeleton className="mt-3 h-8 w-full" />
      ) : drives.isError ? (
        <p className="mt-3 text-sm text-[var(--color-danger)]">Couldn&apos;t load drives.</p>
      ) : drives.data && drives.data.length > 0 ? (
        <div className="mt-3 space-y-3">
          {drives.data.map((drive) => (
            <DriveRow key={drive.id} drive={drive} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">No drives yet for this JD.</p>
      )}
    </div>
  );
}

const NEXT_STATUS: Record<DriveStatus, DriveStatus[]> = {
  DRAFT: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const ROUND_TYPES = ["APTITUDE", "CODING", "GD", "TECHNICAL", "HR", "OFFER"] as const;

function DriveRow({ drive }: { drive: Drive }) {
  const role = useAuthStore((s) => s.user?.role);
  const updateStatus = useUpdateDriveStatus(drive.id);
  const createRound = useCreateRound(drive.id);
  const { show } = useToast();
  const [showRoundForm, setShowRoundForm] = useState(false);
  const [showEligibility, setShowEligibility] = useState(false);
  const [roundType, setRoundType] = useState<(typeof ROUND_TYPES)[number]>("APTITUDE");
  const [position, setPosition] = useState(String(drive.rounds.length + 1));

  const canChangeStatus = role === "SUPER_ADMIN" || role === "TPO";
  const canSeeEligibility = role === "SUPER_ADMIN" || role === "TPO" || role === "FACULTY_COORD";
  const canAddRound =
    (role === "SUPER_ADMIN" || role === "TPO" || role === "FACULTY_COORD") &&
    drive.status === "DRAFT";

  async function handleAddRound(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createRound.mutateAsync({ type: roundType, position: Number(position) });
      show({ tone: "success", title: "Round added", description: `${roundType} · position ${position}` });
      setShowRoundForm(false);
      setPosition(String(drive.rounds.length + 2));
    } catch {
      show({ tone: "danger", title: "Couldn't add round", description: "That position may already be taken." });
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-neutral-200 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[drive.status]} dot>
            {drive.status}
          </Badge>
          <span className="text-xs text-neutral-500">
            {drive.scheduledAt ? new Date(drive.scheduledAt).toLocaleDateString() : "unscheduled"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {canSeeEligibility && (
            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowEligibility(true)}>
              Eligibility
            </Button>
          )}
          {canChangeStatus &&
            NEXT_STATUS[drive.status].map((next) => (
              <Button
                key={next}
                variant="ghost"
                className="h-7 px-2 text-xs"
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ status: next })}
              >
                → {next}
              </Button>
            ))}
        </div>
      </div>

      {drive.rounds.length > 0 && (
        <ol className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600">
          {[...drive.rounds]
            .sort((a, b) => a.position - b.position)
            .map((round) => (
              <li key={round.id} className="rounded-[var(--radius-sm)] bg-neutral-100 px-2 py-1">
                {round.position}. {round.type}
              </li>
            ))}
        </ol>
      )}

      {canAddRound && (
        <div className="mt-2">
          {showRoundForm ? (
            <form className="flex flex-wrap items-end gap-2" onSubmit={handleAddRound}>
              <div>
                <Label htmlFor={`round-type-${drive.id}`}>Type</Label>
                <Select
                  id={`round-type-${drive.id}`}
                  value={roundType}
                  onChange={(e) => setRoundType(e.target.value as (typeof ROUND_TYPES)[number])}
                  className="w-36"
                >
                  {ROUND_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`round-position-${drive.id}`}>Position</Label>
                <Input
                  id={`round-position-${drive.id}`}
                  type="number"
                  min="1"
                  className="w-20"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={createRound.isPending}>
                {createRound.isPending ? "Adding…" : "Add"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowRoundForm(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowRoundForm(true)}>
              + Add round
            </Button>
          )}
        </div>
      )}

      {showEligibility && <DriveEligibilityDialog driveId={drive.id} onClose={() => setShowEligibility(false)} />}
    </div>
  );
}

function DriveEligibilityDialog({ driveId, onClose }: { driveId: string; onClose: () => void }) {
  const eligibility = useDriveEligibility(driveId);

  return (
    <Dialog open onClose={onClose} title="Eligibility for this drive" description="Cached results are instant; new students are evaluated on demand.">
      {eligibility.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : eligibility.data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-md)] bg-neutral-50 p-3 text-center">
              <p className="text-xl font-semibold text-neutral-900">{eligibility.data.summary.eligibleCount}</p>
              <p className="text-xs text-neutral-500">Eligible</p>
            </div>
            <div className="rounded-[var(--radius-md)] bg-neutral-50 p-3 text-center">
              <p className="text-xl font-semibold text-neutral-900">{eligibility.data.summary.ineligibleCount}</p>
              <p className="text-xs text-neutral-500">Ineligible</p>
            </div>
          </div>
          <p className="text-xs text-neutral-400">
            {eligibility.data.summary.fromCache} from cache · {eligibility.data.summary.freshlyEvaluated} freshly evaluated
          </p>
          {eligibility.data.eligible.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">Eligible</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {eligibility.data.eligible.map((s) => (
                  <li key={s.id} className="flex items-center gap-1.5 text-neutral-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" />
                    {s.displayName} <span className="text-neutral-400">· {s.departmentCode}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {eligibility.data.ineligible.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">Ineligible</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {eligibility.data.ineligible.map((row) => (
                  <li key={row.student.id} className="text-neutral-700">
                    <span className="flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                      {row.student.displayName}
                      <span className="text-neutral-400">· {row.student.departmentCode}</span>
                    </span>
                    {row.reasons.filter((r) => !r.passed).length > 0 && (
                      <p className="ml-5 mt-0.5 flex items-center gap-1 text-xs text-neutral-400">
                        <ChevronRight className="h-3 w-3" />
                        {row.reasons.find((r) => !r.passed)?.message}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-danger)]">Couldn&apos;t load eligibility for this drive.</p>
      )}
    </Dialog>
  );
}
