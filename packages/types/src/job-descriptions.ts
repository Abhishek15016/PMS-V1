import { z } from "zod";

export const SlabSchema = z.enum(["DREAM", "SUPER_DREAM", "NON_DREAM"]);
export type Slab = z.infer<typeof SlabSchema>;

export const JobDescriptionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  companyId: z.string(),
  title: z.string(),
  ctcLpa: z.number(),
  ctcBreakup: z.unknown().nullable(),
  slab: SlabSchema.nullable(),
  eligiblePrograms: z.array(z.string()),
  minCriteria: z.record(z.string(), z.unknown()),
  location: z.string().nullable(),
  bondMonths: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type JobDescription = z.infer<typeof JobDescriptionSchema>;

export const CreateJobDescriptionInputSchema = z.object({
  companyId: z.string(),
  title: z.string().min(1),
  ctcLpa: z.number().positive(),
  eligiblePrograms: z.array(z.string()),
  minCriteria: z.record(z.string(), z.unknown()),
  location: z.string().optional(),
  bondMonths: z.number().min(0).optional(),
});
export type CreateJobDescriptionInput = z.infer<typeof CreateJobDescriptionInputSchema>;
