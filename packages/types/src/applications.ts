import { z } from "zod";

export const ApplicationStatusSchema = z.enum([
  "APPLIED",
  "SHORTLISTED",
  "IN_ROUND",
  "REJECTED",
  "SELECTED",
  "WITHDRAWN",
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const RoundResultStatusSchema = z.enum(["PENDING", "PASS", "FAIL"]);
export type RoundResultStatus = z.infer<typeof RoundResultStatusSchema>;

export const RoundResultSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  applicationId: z.string(),
  roundId: z.string(),
  status: RoundResultStatusSchema,
  score: z.number().nullable(),
  notes: z.string().nullable(),
  recordedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RoundResult = z.infer<typeof RoundResultSchema>;

export const ApplicationStudentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  departmentId: z.string(),
  rollNumber: z.string().nullable(),
  placementStatus: z.string(),
});

export const ApplicationDriveSchema = z.object({
  id: z.string(),
  status: z.string(),
  jobDescription: z.object({
    id: z.string(),
    title: z.string(),
    ctcLpa: z.number(),
    companyId: z.string(),
  }),
});

export const ApplicationSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  studentId: z.string(),
  driveId: z.string(),
  status: ApplicationStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  student: ApplicationStudentSchema,
  drive: ApplicationDriveSchema,
  roundResults: z.array(RoundResultSchema),
});
export type Application = z.infer<typeof ApplicationSchema>;

export const CreateApplicationInputSchema = z.object({
  driveId: z.string().min(1),
  studentId: z.string().optional(),
});
export type CreateApplicationInput = z.infer<
  typeof CreateApplicationInputSchema
>;

export const RecordRoundResultInputSchema = z.object({
  roundId: z.string().min(1),
  status: RoundResultStatusSchema,
  score: z.number().optional(),
  notes: z.string().optional(),
});
export type RecordRoundResultInput = z.infer<
  typeof RecordRoundResultInputSchema
>;
