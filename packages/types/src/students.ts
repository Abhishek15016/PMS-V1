import { z } from "zod";
import { RoleSchema } from "./role";

export const PlacementStatusSchema = z.enum(["UNPLACED", "PLACED", "DEBARRED", "OPTED_OUT"]);
export type PlacementStatus = z.infer<typeof PlacementStatusSchema>;

export const StudentUserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: RoleSchema,
  departmentId: z.string().nullable(),
  companyId: z.string().nullable(),
  authProvider: z.string(),
  externalId: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export const StudentDepartmentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  code: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export const StudentBatchSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  label: z.string(),
  startYear: z.number(),
  endYear: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const StudentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  departmentId: z.string(),
  batchId: z.string(),
  rollNumber: z.string().nullable(),
  cgpa: z.string().nullable(),
  tenthPercent: z.string().nullable(),
  twelfthPercent: z.string().nullable(),
  activeBacklogs: z.number(),
  backlogHistory: z.number(),
  gapYears: z.number(),
  diplomaFlag: z.boolean(),
  category: z.string().nullable(),
  contactPhone: z.string().nullable(),
  resumeUrl: z.string().nullable(),
  placementStatus: PlacementStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  user: StudentUserSchema,
  department: StudentDepartmentSchema,
  batch: StudentBatchSchema,
});
export type Student = z.infer<typeof StudentSchema>;
