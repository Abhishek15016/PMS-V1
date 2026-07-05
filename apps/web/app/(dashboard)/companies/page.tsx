"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Building2, Plus, Search } from "lucide-react";
import {
  Badge,
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
import type { Company } from "@pms/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useCompanies, useCreateCompany } from "@/lib/companies/use-companies";
import { CompanyLogo } from "@/components/company-logo";
import { ApiError } from "@/lib/api-client";

const TIER_LABEL: Record<string, string> = {
  "tier-1": "Tier 1",
  "tier-2": "Tier 2",
  "tier-3": "Tier 3",
};

function domainOf(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default function CompaniesPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const companies = useCompanies();
  const canCreate = role === "SUPER_ADMIN" || role === "TPO";

  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [tier, setTier] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (companies.isError && companies.error instanceof ApiError && companies.error.status === 403) {
      router.replace("/forbidden?resource=companies.records");
    }
  }, [companies.isError, companies.error, router]);

  // Filter options come from the data itself, so new sectors/tiers appear automatically.
  const sectors = useMemo(
    () => [...new Set((companies.data ?? []).map((c) => c.sector).filter((s): s is string => !!s))].sort(),
    [companies.data],
  );
  const tiers = useMemo(
    () => [...new Set((companies.data ?? []).map((c) => c.tier).filter((t): t is string => !!t))].sort(),
    [companies.data],
  );

  const rows = useMemo(() => {
    let list = companies.data ?? [];
    if (sector) list = list.filter((c) => c.sector === sector);
    if (tier) list = list.filter((c) => c.tier === tier);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.sector ?? "").toLowerCase().includes(q));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [companies.data, sector, tier, query]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Companies & Drives"
        description="Recruiter CRM and the drive/round pipeline for each job description."
        actions={
          canCreate && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Add company
            </Button>
          )
        }
      />

      <CreateCompanyDialog open={showForm} onClose={() => setShowForm(false)} sectors={sectors} />

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <Label htmlFor="company-search">Search</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                id="company-search"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Company or sector…"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="sector-filter">Sector</Label>
            <Select id="sector-filter" className="mt-1 w-44" value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">All sectors</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tier-filter">Tier</Label>
            <Select id="tier-filter" className="mt-1 w-36" value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="">All tiers</option>
              {tiers.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t] ?? t}
                </option>
              ))}
            </Select>
          </div>
          {rows.length > 0 && (
            <span className="mb-2 ml-auto text-xs font-medium text-neutral-400">
              {rows.length} recruiting partner{rows.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </Card>

      {companies.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[var(--radius-xl)]" />
          ))}
        </div>
      ) : companies.isError ? (
        companies.error instanceof ApiError && companies.error.status === 403 ? null : (
          <Card>
            <p className="text-sm text-[var(--color-danger)]">Couldn&apos;t load companies. Try again in a moment.</p>
          </Card>
        )
      ) : rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title={query || sector || tier ? "No companies match" : "No companies yet"}
            description={
              query || sector || tier
                ? "Try clearing the search or filters."
                : canCreate
                  ? "Add your first recruiting partner to start posting job descriptions."
                  : "Companies will show up here once your TPO adds them."
            }
            action={
              canCreate &&
              !(query || sector || tier) && (
                <Button variant="secondary" onClick={() => setShowForm(true)}>
                  + Add company
                </Button>
              )
            }
          />
        </Card>
      )}
    </div>
  );
}

function CompanyCard({ company }: { company: Company }) {
  const domain = domainOf(company.website);
  return (
    <Link href={`/companies/${company.id}`}>
      <Card interactive className="group h-full">
        <div className="flex items-start gap-3.5">
          <CompanyLogo name={company.name} website={company.website} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900 group-hover:text-brand-700">
              {company.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-neutral-500">{company.sector ?? "Sector not set"}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {company.tier && <Badge tone="brand">{TIER_LABEL[company.tier] ?? company.tier}</Badge>}
              {domain && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                  {domain}
                </span>
              )}
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-500" />
        </div>
      </Card>
    </Link>
  );
}

function CreateCompanyDialog({
  open,
  onClose,
  sectors,
}: {
  open: boolean;
  onClose: () => void;
  sectors: string[];
}) {
  const createCompany = useCreateCompany();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [tier, setTier] = useState("");
  const [website, setWebsite] = useState("");

  function reset() {
    setName("");
    setSector("");
    setTier("");
    setWebsite("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCompany.mutateAsync({
        name,
        sector: sector || undefined,
        tier: tier || undefined,
        website: website || undefined,
      });
      show({ tone: "success", title: "Company added", description: `${name} is now on your recruiter list.` });
      reset();
      onClose();
    } catch {
      show({ tone: "danger", title: "Couldn't add company", description: "Check the fields and try again." });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add a company" description="Recruiting partners power job descriptions and drives.">
      <form className="grid grid-cols-2 gap-4" onSubmit={handleSubmit}>
        <div className="col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <Label htmlFor="sector">Sector</Label>
          <Input
            id="sector"
            list="sector-suggestions"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="IT Services"
          />
          <datalist id="sector-suggestions">
            {sectors.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="tier">Tier</Label>
          <Select id="tier" value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">Not classified</option>
            <option value="tier-1">Tier 1 — marquee</option>
            <option value="tier-2">Tier 2 — regular</option>
            <option value="tier-3">Tier 3 — emerging</option>
          </Select>
        </div>
        <div className="col-span-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
          <p className="mt-1 text-xs text-neutral-400">The company logo is picked up automatically from this domain.</p>
        </div>

        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createCompany.isPending}>
            {createCompany.isPending ? "Saving…" : "Save company"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
