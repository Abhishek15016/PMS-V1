"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, GraduationCap, Search, Users } from "lucide-react";
import {
  Avatar,
  Badge,
  BadgeTone,
  Card,
  Dialog,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  cn,
} from "@pms/ui";
import type { PlacementStatus, Student } from "@pms/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useFilterOptions } from "@/lib/analytics/use-analytics";
import { useStudents } from "@/lib/students/use-students";
import { ApiError } from "@/lib/api-client";

/** DB Decimal fields serialize as strings and can carry float noise (e.g. "8.199999999999999") — round for display only. */
function formatDecimal(v: string | null): string {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : v;
}

const STATUS_TONE: Record<PlacementStatus, BadgeTone> = {
  UNPLACED: "neutral",
  PLACED: "success",
  DEBARRED: "danger",
  OPTED_OUT: "warning",
};

const STATUS_OPTIONS: Array<{ value: PlacementStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PLACED", label: "Placed" },
  { value: "UNPLACED", label: "Unplaced" },
  { value: "DEBARRED", label: "Debarred" },
  { value: "OPTED_OUT", label: "Opted out" },
];

type SortKey = "name" | "cgpa-desc" | "cgpa-asc" | "roll";

function cgpaNumber(s: Student): number {
  const n = Number(s.cgpa);
  return Number.isFinite(n) ? n : 0;
}

/** A student is "at risk" when they're unplaced AND carrying backlogs or a sub-6.5 CGPA — the cohort the placement cell chases first. */
function isAtRisk(s: Student): boolean {
  return s.placementStatus === "UNPLACED" && (s.activeBacklogs > 0 || cgpaNumber(s) < 6.5);
}

function CgpaCell({ student }: { student: Student }) {
  const n = cgpaNumber(student);
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-sm tabular-nums text-neutral-900">{formatDecimal(student.cgpa)}</span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-neutral-100">
        <span
          className={cn(
            "block h-full rounded-full",
            n >= 8.5 ? "bg-emerald-500" : n >= 7 ? "bg-brand-500" : n >= 6 ? "bg-amber-500" : "bg-rose-500",
          )}
          style={{ width: `${Math.min(n * 10, 100)}%` }}
        />
      </span>
    </div>
  );
}

export default function StudentsPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const isFull = role === "SUPER_ADMIN" || role === "TPO";
  const isDeptScoped = role === "FACULTY_COORD";
  const isSelf = role === "STUDENT";

  const [departmentId, setDepartmentId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [status, setStatus] = useState<PlacementStatus | "">("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const filterOptions = useFilterOptions(isFull || isDeptScoped);
  const students = useStudents({
    departmentId: isFull && departmentId ? departmentId : undefined,
    batchId: !isSelf && batchId ? batchId : undefined,
  });
  const [selected, setSelected] = useState<Student | null>(null);

  useEffect(() => {
    if (students.isError && students.error instanceof ApiError && students.error.status === 403) {
      router.replace("/forbidden?resource=students.records");
    }
  }, [students.isError, students.error, router]);

  const rows = useMemo(() => {
    let list = students.data ?? [];
    if (status) list = list.filter((s) => s.placementStatus === status);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.user.displayName.toLowerCase().includes(q) ||
          (s.rollNumber ?? "").toLowerCase().includes(q) ||
          s.user.email.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      switch (sort) {
        case "cgpa-desc":
          return cgpaNumber(b) - cgpaNumber(a);
        case "cgpa-asc":
          return cgpaNumber(a) - cgpaNumber(b);
        case "roll":
          return (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "");
        default:
          return a.user.displayName.localeCompare(b.user.displayName);
      }
    });
  }, [students.data, status, query, sort]);

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const placed = rows.filter((s) => s.placementStatus === "PLACED").length;
    const avgCgpa = rows.reduce((a, s) => a + cgpaNumber(s), 0) / rows.length;
    const atRisk = rows.filter(isAtRisk).length;
    return { total: rows.length, placed, placedPct: (placed / rows.length) * 100, avgCgpa, atRisk };
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Students"
        description={
          isSelf
            ? "Your profile as it appears to placement staff."
            : "Cohort profiles, backlog history, and placement status."
        }
      />

      {!isSelf && (
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1">
              <Label htmlFor="student-search">Search</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="student-search"
                  className="pl-8"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, roll number, or email…"
                />
              </div>
            </div>
            {isFull && (
              <div>
                <Label htmlFor="dept-filter">Department</Label>
                <Select
                  id="dept-filter"
                  className="mt-1 w-44"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
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
            <div>
              <Label htmlFor="batch-filter">Batch</Label>
              <Select id="batch-filter" className="mt-1 w-36" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">All batches</option>
                {filterOptions.data?.batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select
                id="status-filter"
                className="mt-1 w-36"
                value={status}
                onChange={(e) => setStatus(e.target.value as PlacementStatus | "")}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="sort-select">Sort by</Label>
              <Select id="sort-select" className="mt-1 w-40" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="name">Name (A–Z)</option>
                <option value="cgpa-desc">CGPA (high → low)</option>
                <option value="cgpa-asc">CGPA (low → high)</option>
                <option value="roll">Roll number</option>
              </Select>
            </div>
          </div>

          {stats && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
                <Users className="h-3 w-3" />
                {stats.total} student{stats.total === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                {stats.placed} placed ({stats.placedPct.toFixed(0)}%)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">
                Avg CGPA {stats.avgCgpa.toFixed(2)}
              </span>
              {stats.atRisk > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.atRisk} at risk
                </span>
              )}
            </div>
          )}
        </Card>
      )}

      <Card className="p-0">
        {students.isLoading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : students.isError ? (
          students.error instanceof ApiError && students.error.status === 403 ? null : (
            <p className="p-6 text-sm text-[var(--color-danger)]">Couldn&apos;t load students. Try again in a moment.</p>
          )
        ) : rows.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="pl-6">Student</TableHeaderCell>
                <TableHeaderCell>Roll no.</TableHeaderCell>
                <TableHeaderCell>Dept · Batch</TableHeaderCell>
                <TableHeaderCell>CGPA</TableHeaderCell>
                <TableHeaderCell>Backlogs</TableHeaderCell>
                <TableHeaderCell className="pr-6">Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} interactive className="cursor-pointer" onClick={() => setSelected(s)}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.user.displayName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900">{s.user.displayName}</p>
                        <p className="truncate text-xs text-neutral-400">{s.user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{s.rollNumber ?? "—"}</TableCell>
                  <TableCell>
                    <span className="font-medium text-neutral-700">{s.department.code}</span>
                    <span className="text-neutral-400"> · {s.batch.label}</span>
                  </TableCell>
                  <TableCell>
                    <CgpaCell student={s} />
                  </TableCell>
                  <TableCell>
                    {s.activeBacklogs > 0 ? (
                      <Badge tone="danger">{s.activeBacklogs} active</Badge>
                    ) : (
                      <span className="text-neutral-400">None</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={STATUS_TONE[s.placementStatus]} dot>
                        {s.placementStatus.replace("_", " ")}
                      </Badge>
                      {isAtRisk(s) && (
                        <span title="Unplaced with backlogs or CGPA below 6.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<GraduationCap className="h-5 w-5" />}
            title="No students match"
            description="Try clearing the search or picking different filters."
          />
        )}
      </Card>

      {selected && <StudentDetailDialog student={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/** 0–100 heuristic from academics the registrar already tracks — CGPA carries most weight; backlogs and gap years pull it down. */
function profileStrength(s: Student): { score: number; label: string } {
  const cgpa = cgpaNumber(s);
  let score = Math.min(cgpa / 10, 1) * 70;
  score += s.resumeUrl ? 10 : 0;
  score += s.activeBacklogs === 0 ? 12 : Math.max(0, 12 - s.activeBacklogs * 6);
  score += s.gapYears === 0 ? 8 : 2;
  const rounded = Math.round(score);
  return {
    score: rounded,
    label: rounded >= 80 ? "Strong" : rounded >= 60 ? "Solid" : rounded >= 45 ? "Developing" : "Needs attention",
  };
}

function StudentDetailDialog({ student, onClose }: { student: Student; onClose: () => void }) {
  const strength = profileStrength(student);
  return (
    <Dialog open onClose={onClose} title={student.user.displayName} description={student.user.email}>
      <div className="mb-5 rounded-[var(--radius-lg)] border border-neutral-100 bg-neutral-50/60 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-neutral-900">Profile strength</span>
          <span className="font-semibold text-neutral-900">
            {strength.score}/100 · {strength.label}
          </span>
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
        <p className="mt-2 text-xs text-neutral-500">
          Weighted from CGPA, backlogs, gap years, and resume presence — the same signals the eligibility engine checks.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Roll number" value={student.rollNumber ?? "—"} />
        <Field label="Department" value={`${student.department.name} (${student.department.code})`} />
        <Field label="Batch" value={student.batch.label} />
        <Field label="Category" value={student.category ?? "—"} />
        <Field label="CGPA" value={formatDecimal(student.cgpa)} />
        <Field label="10th %" value={formatDecimal(student.tenthPercent)} />
        <Field label="12th %" value={formatDecimal(student.twelfthPercent)} />
        <Field label="Diploma" value={student.diplomaFlag ? "Yes" : "No"} />
        <Field label="Active backlogs" value={String(student.activeBacklogs)} />
        <Field label="Backlog history" value={String(student.backlogHistory)} />
        <Field label="Gap years" value={String(student.gapYears)} />
        <Field label="Contact" value={student.contactPhone ?? "—"} />
        <div className="col-span-2">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Placement status</p>
          <div className="mt-1">
            <Badge tone={STATUS_TONE[student.placementStatus]} dot>
              {student.placementStatus.replace("_", " ")}
            </Badge>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-0.5 text-neutral-900">{value}</p>
    </div>
  );
}
