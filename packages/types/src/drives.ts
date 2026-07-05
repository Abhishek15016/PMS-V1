import { z } from "zod";
import { JobDescriptionSchema } from "./job-descriptions";

export const DriveStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);
export type DriveStatus = z.infer<typeof DriveStatusSchema>;

export const RoundTypeSchema = z.enum([
  "APTITUDE",
  "CODING",
  "GD",
  "TECHNICAL",
  "HR",
  "OFFER",
]);
export type RoundType = z.infer<typeof RoundTypeSchema>;

export const RoundSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  driveId: z.string(),
  type: RoundTypeSchema,
  position: z.number(),
  mode: z.string().nullable(),
  cutoff: z.number().nullable(),
  scheduledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Round = z.infer<typeof RoundSchema>;

export const DriveSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  jdId: z.string(),
  status: DriveStatusSchema,
  scheduledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  rounds: z.array(RoundSchema),
  jobDescription: JobDescriptionSchema,
});
export type Drive = z.infer<typeof DriveSchema>;

export const CreateDriveInputSchema = z.object({
  jdId: z.string(),
  status: DriveStatusSchema.optional(),
  scheduledAt: z.string().optional(),
});
export type CreateDriveInput = z.infer<typeof CreateDriveInputSchema>;

export const UpdateDriveStatusInputSchema = z.object({
  status: DriveStatusSchema,
});
export type UpdateDriveStatusInput = z.infer<typeof UpdateDriveStatusInputSchema>;

export const CreateRoundInputSchema = z.object({
  type: RoundTypeSchema,
  position: z.number().int().min(1),
  mode: z.string().optional(),
  cutoff: z.number().optional(),
  scheduledAt: z.string().optional(),
});
export type CreateRoundInput = z.infer<typeof CreateRoundInputSchema>;
