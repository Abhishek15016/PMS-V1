"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  useToast,
} from "@pms/ui";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useCompanies, useCreateCompany } from "@/lib/companies/use-companies";
import { ApiError } from "@/lib/api-client";

export default function CompaniesPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const companies = useCompanies();
  const canCreate = role === "SUPER_ADMIN" || role === "TPO";

  useEffect(() => {
    if (companies.isError && companies.error instanceof ApiError && companies.error.status === 403) {
      router.replace("/forbidden?resource=companies.records");
    }
  }, [companies.isError, companies.error, router]);

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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

      <CreateCompanyDialog open={showForm} onClose={() => setShowForm(false)} />

      <Card className="p-0">
        {companies.isLoading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : companies.isError ? (
          companies.error instanceof ApiError && companies.error.status === 403 ? null : (
            <p className="p-6 text-sm text-[var(--color-danger)]">
              Couldn&apos;t load companies. Try again in a moment.
            </p>
          )
        ) : companies.data && companies.data.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="pl-6">Name</TableHeaderCell>
                <TableHeaderCell>Sector</TableHeaderCell>
                <TableHeaderCell>Tier</TableHeaderCell>
                <TableHeaderCell className="pr-6">Website</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {companies.data.map((company) => (
                <TableRow key={company.id} interactive>
                  <TableCell className="pl-6">
                    <Link
                      href={`/companies/${company.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {company.name}
                    </Link>
                  </TableCell>
                  <TableCell>{company.sector ?? "—"}</TableCell>
                  <TableCell>
                    {company.tier ? <Badge tone="brand">{company.tier}</Badge> : "—"}
                  </TableCell>
                  <TableCell className="pr-6">{company.website ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No companies yet"
            description={
              canCreate
                ? "Add your first recruiting partner to start posting job descriptions."
                : "Companies will show up here once your TPO adds them."
            }
            action={
              canCreate && (
                <Button variant="secondary" onClick={() => setShowForm(true)}>
                  + Add company
                </Button>
              )
            }
          />
        )}
      </Card>
    </div>
  );
}

function CreateCompanyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <Input id="sector" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="IT Services" />
        </div>
        <div>
          <Label htmlFor="tier">Tier</Label>
          <Input id="tier" value={tier} onChange={(e) => setTier(e.target.value)} placeholder="tier-1" />
        </div>
        <div className="col-span-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
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
