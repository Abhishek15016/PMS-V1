"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Plus, Sparkles } from "lucide-react";
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
import type { Company, Offer, OfferStatus, Slab } from "@pms/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import {
  useAcceptOffer,
  useApproveOffer,
  useCreateOffer,
  useCreatePpoOffer,
  useOffers,
  useRejectOffer,
  useRevokeOffer,
} from "@/lib/offers/use-offers";
import { useApplications } from "@/lib/applications/use-applications";
import { useStudents } from "@/lib/students/use-students";
import { useCompanies } from "@/lib/companies/use-companies";
import { CompanyLogo } from "@/components/company-logo";
import { ApiError } from "@/lib/api-client";

const STATUS_TONE: Record<OfferStatus, BadgeTone> = {
  PENDING: "neutral",
  EXTENDED: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  REVOKED: "neutral",
};

const SLAB_TONE: Record<Slab, BadgeTone> = {
  DREAM: "success",
  SUPER_DREAM: "brand",
  NON_DREAM: "neutral",
};

const STATUS_FILTERS: Array<{ value: OfferStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending approval" },
  { value: "EXTENDED", label: "Extended" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "REVOKED", label: "Revoked" },
];

const SLAB_FILTERS: Array<{ value: Slab | ""; label: string }> = [
  { value: "", label: "All slabs" },
  { value: "DREAM", label: "Dream (₹25L+)" },
  { value: "SUPER_DREAM", label: "Super Dream (₹8L+)" },
  { value: "NON_DREAM", label: "Non-Dream" },
];

export default function OffersPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const offers = useOffers();
  const companies = useCompanies();
  const isTpo = role === "TPO" || role === "SUPER_ADMIN";
  const isRecruiter = role === "RECRUITER";
  const isStudent = role === "STUDENT";
  const canExtend = isTpo || isRecruiter;

  useEffect(() => {
    if (offers.isError && offers.error instanceof ApiError && offers.error.status === 403) {
      router.replace("/forbidden?resource=offers.manage");
    }
  }, [offers.isError, offers.error, router]);

  const [showForm, setShowForm] = useState<"offer" | "ppo" | null>(null);
  const [statusFilter, setStatusFilter] = useState<OfferStatus | "">("");
  const [slabFilter, setSlabFilter] = useState<Slab | "">("");

  const companyById = useMemo(() => {
    const map = new Map<string, Company>();
    for (const c of companies.data ?? []) map.set(c.id, c);
    return map;
  }, [companies.data]);

  const rows = useMemo(() => {
    let list = offers.data ?? [];
    if (statusFilter) list = list.filter((o) => o.status === statusFilter);
    if (slabFilter) list = list.filter((o) => o.slab === slabFilter);
    return [...list].sort((a, b) => b.ctcLpa - a.ctcLpa);
  }, [offers.data, statusFilter, slabFilter]);

  const stats = useMemo(() => {
    const all = offers.data ?? [];
    if (all.length === 0) return null;
    const accepted = all.filter((o) => o.status === "ACCEPTED");
    const decided = all.filter((o) => o.status === "ACCEPTED" || o.status === "REJECTED");
    const ppos = all.filter((o) => o.isPpo).length;
    const top = Math.max(...all.map((o) => o.ctcLpa));
    return {
      total: all.length,
      accepted: accepted.length,
      acceptanceRate: decided.length > 0 ? (accepted.length / decided.length) * 100 : null,
      ppos,
      top,
    };
  }, [offers.data]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Offers"
        description="Extend, approve, accept/reject, and revoke offers — including PPOs."
        actions={
          <div className="flex gap-2">
            {canExtend && (
              <Button onClick={() => setShowForm("offer")}>
                <Plus className="h-4 w-4" />
                Extend offer
              </Button>
            )}
            {isTpo && (
              <Button variant="secondary" onClick={() => setShowForm("ppo")}>
                <Plus className="h-4 w-4" />
                Convert PPO
              </Button>
            )}
          </div>
        }
      />

      {canExtend && (
        <CreateOfferDialog open={showForm === "offer"} onClose={() => setShowForm(null)} canListApplications={isTpo} />
      )}
      {isTpo && <CreatePpoDialog open={showForm === "ppo"} onClose={() => setShowForm(null)} />}

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="offer-status-filter">Status</Label>
            <Select
              id="offer-status-filter"
              className="mt-1 w-44"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OfferStatus | "")}
            >
              {STATUS_FILTERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="offer-slab-filter">Slab</Label>
            <Select
              id="offer-slab-filter"
              className="mt-1 w-48"
              value={slabFilter}
              onChange={(e) => setSlabFilter(e.target.value as Slab | "")}
            >
              {SLAB_FILTERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {stats && (
            <div className="mb-1 ml-auto flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
                {stats.total} offers
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                {stats.accepted} accepted
                {stats.acceptanceRate != null ? ` (${stats.acceptanceRate.toFixed(0)}%)` : ""}
              </span>
              {stats.ppos > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">
                  <Sparkles className="h-3 w-3" />
                  {stats.ppos} PPOs
                </span>
              )}
              <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
                Top ₹{stats.top}L
              </span>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-0">
        {offers.isLoading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : offers.isError ? (
          offers.error instanceof ApiError && offers.error.status === 403 ? null : (
            <p className="p-6 text-sm text-[var(--color-danger)]">Couldn&apos;t load offers. Try again in a moment.</p>
          )
        ) : rows.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {rows.map((offer) => (
              <OfferRow
                key={offer.id}
                offer={offer}
                isTpo={isTpo}
                isStudent={isStudent}
                company={
                  offer.application
                    ? companyById.get(offer.application.drive.jobDescription.companyId)
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Award className="h-5 w-5" />}
            title={statusFilter || slabFilter ? "No offers match the filters" : "No offers yet"}
            description={
              statusFilter || slabFilter
                ? "Try clearing the filters."
                : canExtend
                  ? "Extend an offer once a candidate clears the pipeline."
                  : undefined
            }
          />
        )}
      </Card>
    </div>
  );
}

function CreateOfferDialog({
  open,
  onClose,
  canListApplications,
}: {
  open: boolean;
  onClose: () => void;
  canListApplications: boolean;
}) {
  const createOffer = useCreateOffer();
  const { show } = useToast();
  const applications = useApplications(undefined, canListApplications);
  const [applicationId, setApplicationId] = useState("");
  const [ctcLpa, setCtcLpa] = useState("");

  function reset() {
    setApplicationId("");
    setCtcLpa("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createOffer.mutateAsync({ applicationId, ctcLpa: Number(ctcLpa) });
      show({ tone: "success", title: "Offer extended" });
      reset();
      onClose();
    } catch {
      show({
        tone: "danger",
        title: "Couldn't extend this offer",
        description: "Check the offer cap and re-eligibility policy.",
      });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Extend an offer">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="applicationId">Application</Label>
          {canListApplications ? (
            <Select
              id="applicationId"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              required
            >
              <option value="" disabled>
                {applications.isLoading ? "Loading applications…" : "Select an application"}
              </option>
              {applications.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.student.rollNumber ?? a.studentId} · {a.drive.jobDescription.title} · {a.status}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="applicationId"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              placeholder="Application ID (shared by your placement office)"
              required
            />
          )}
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

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createOffer.isPending || !applicationId}>
            {createOffer.isPending ? "Extending…" : "Extend offer"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CreatePpoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createPpo = useCreatePpoOffer();
  const { show } = useToast();
  const students = useStudents();
  const [studentId, setStudentId] = useState("");
  const [sourceInternshipId, setSourceInternshipId] = useState("");
  const [ctcLpa, setCtcLpa] = useState("");

  function reset() {
    setStudentId("");
    setSourceInternshipId("");
    setCtcLpa("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createPpo.mutateAsync({ studentId, sourceInternshipId, ctcLpa: Number(ctcLpa) });
      show({ tone: "success", title: "PPO offer created" });
      reset();
      onClose();
    } catch {
      show({
        tone: "danger",
        title: "Couldn't convert this internship",
        description: "Check the offer cap and re-eligibility policy.",
      });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Convert an internship to a PPO">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="ppo-studentId">Student</Label>
          <Select id="ppo-studentId" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            <option value="" disabled>
              {students.isLoading ? "Loading students…" : "Select a student"}
            </option>
            {students.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.rollNumber ?? s.user.displayName} · {s.department.code}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ppo-internshipId">Source internship ID</Label>
          <Input
            id="ppo-internshipId"
            value={sourceInternshipId}
            onChange={(e) => setSourceInternshipId(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="ppo-ctcLpa">CTC (LPA)</Label>
          <Input
            id="ppo-ctcLpa"
            type="number"
            step="0.1"
            min="0"
            value={ctcLpa}
            onChange={(e) => setCtcLpa(e.target.value)}
            required
          />
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createPpo.isPending || !studentId}>
            {createPpo.isPending ? "Converting…" : "Convert to PPO"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function OfferRow({
  offer,
  isTpo,
  isStudent,
  company,
}: {
  offer: Offer;
  isTpo: boolean;
  isStudent: boolean;
  company: Company | undefined;
}) {
  const approve = useApproveOffer();
  const accept = useAcceptOffer();
  const reject = useRejectOffer();
  const revoke = useRevokeOffer();
  const { show } = useToast();

  const canApprove = isTpo && offer.status === "PENDING";
  const canAcceptReject = isStudent && offer.status === "EXTENDED";
  const canRevoke = isTpo && offer.status !== "REVOKED";

  const title = offer.application?.drive.jobDescription.title ?? (offer.isPpo ? "PPO conversion" : "Offer");

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CompanyLogo
            name={company?.name ?? (offer.isPpo ? "PPO" : "Offer")}
            website={company?.website}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900">
              {company ? `${company.name} — ${title}` : title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-bold text-neutral-900">₹{offer.ctcLpa}L</span>
              {offer.slab && (
                <Badge tone={SLAB_TONE[offer.slab]}>{offer.slab.replace("_", " ")}</Badge>
              )}
              {offer.isPpo && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                  <Sparkles className="h-3 w-3" />
                  PPO
                </span>
              )}
              <span className="text-xs text-neutral-400">
                extended {new Date(offer.extendedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>
          </div>
        </div>
        <Badge tone={STATUS_TONE[offer.status]} dot>
          {offer.status}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {canApprove && (
          <Button
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={approve.isPending}
            onClick={() =>
              approve.mutate(offer.id, {
                onSuccess: () => show({ tone: "success", title: "Offer approved" }),
                onError: () => show({ tone: "danger", title: "Couldn't approve offer" }),
              })
            }
          >
            Approve
          </Button>
        )}
        {canAcceptReject && (
          <>
            <Button
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={accept.isPending}
              onClick={() =>
                accept.mutate(offer.id, {
                  onSuccess: () => show({ tone: "success", title: "Offer accepted" }),
                  onError: () => show({ tone: "danger", title: "Couldn't accept offer" }),
                })
              }
            >
              Accept
            </Button>
            <Button
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={reject.isPending}
              onClick={() =>
                reject.mutate(offer.id, {
                  onSuccess: () => show({ tone: "success", title: "Offer rejected" }),
                  onError: () => show({ tone: "danger", title: "Couldn't reject offer" }),
                })
              }
            >
              Reject
            </Button>
          </>
        )}
        {canRevoke && (
          <Button
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={revoke.isPending}
            onClick={() =>
              revoke.mutate(offer.id, {
                onSuccess: () => show({ tone: "success", title: "Offer revoked" }),
                onError: () => show({ tone: "danger", title: "Couldn't revoke offer" }),
              })
            }
          >
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}
