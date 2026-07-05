"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@pms/ui";

const RESOURCE_LABELS: Record<string, string> = {
  "tenant.config": "institution configuration",
  "policy.rules": "policy rule management",
  "students.records": "student records",
  "import.bulk": "bulk data import",
  "companies.records": "company records",
  "drives.manage": "drive management",
  "jd.shortlist": "job description shortlisting",
  "applications.apply": "drive applications",
  "offers.manage": "offer management",
  "policy.debar": "debar/waive policy",
  "analytics.view": "analytics",
  "reports.accreditation": "accreditation reports",
  "users.manage": "user management",
  "audit.log": "the audit log",
};

/** Per SP-01: explains what permission is missing, not just "Forbidden." Linked to with ?resource=<code> when an API call 403s. */
export default function ForbiddenPage() {
  const params = useSearchParams();
  const resource = params.get("resource");
  const label = resource ? (RESOURCE_LABELS[resource] ?? resource) : undefined;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold text-neutral-900">You don&apos;t have access</h1>
      <p className="mt-2 text-sm text-neutral-500">
        {label
          ? `Your role doesn't have permission to view ${label}.`
          : "Your role doesn't have permission to view this page."}{" "}
        If you think this is wrong, ask your institution&apos;s TPO or Super Admin.
      </p>
      <Link href="/" className="mt-6 inline-block">
        <Button variant="secondary">Back to overview</Button>
      </Link>
    </div>
  );
}
