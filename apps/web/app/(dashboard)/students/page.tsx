"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import {
  Badge,
  BadgeTone,
  Card,
  Dialog,
  EmptyState,
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

export default function StudentsPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const isFull = role === "SUPER_ADMIN" || role === "TPO";
  const isDeptScoped = role === "FACULTY_COORD";
  const isSelf = role === "STUDENT";

  const [departmentId, setDepartmentId] = useState("");
  const [batchId, setBatchId] = useState("");

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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Students"
        description={
          isSelf
            ? "Your profile as it appears to placement staff."
            : "Cohort profiles, backlog history, and placement status."
        }
      />

      {(isFull || isDeptScoped) && (
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            {isFull && (
              <div>
                <Label htmlFor="dept-filter">Department</Label>
                <Select
                  id="dept-filter"
                  className="mt-1 w-52"
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
              <Select id="batch-filter" className="mt-1 w-52" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">All batches</option>
                {filterOptions.data?.batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
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
        ) : students.data && students.data.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="pl-6">Roll no.</TableHeaderCell>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Department</TableHeaderCell>
                <TableHeaderCell>Batch</TableHeaderCell>
                <TableHeaderCell>CGPA</TableHeaderCell>
                <TableHeaderCell>Backlogs</TableHeaderCell>
                <TableHeaderCell className="pr-6">Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.data.map((s) => (
                <TableRow key={s.id} interactive className="cursor-pointer" onClick={() => setSelected(s)}>
                  <TableCell className="pl-6 font-medium text-neutral-900">{s.rollNumber ?? "—"}</TableCell>
                  <TableCell>{s.user.displayName}</TableCell>
                  <TableCell>{s.department.code}</TableCell>
                  <TableCell>{s.batch.label}</TableCell>
                  <TableCell>{formatDecimal(s.cgpa)}</TableCell>
                  <TableCell>{s.activeBacklogs}</TableCell>
                  <TableCell className="pr-6">
                    <Badge tone={STATUS_TONE[s.placementStatus]} dot>
                      {s.placementStatus.replace("_", " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState icon={<GraduationCap className="h-5 w-5" />} title="No students found" description="Try a different department or batch filter." />
        )}
      </Card>

      {selected && <StudentDetailDialog student={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StudentDetailDialog({ student, onClose }: { student: Student; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} title={student.user.displayName} description={student.user.email}>
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
