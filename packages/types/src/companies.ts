import { z } from "zod";

export const CompanySchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  sector: z.string().nullable(),
  tier: z.string().nullable(),
  website: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Company = z.infer<typeof CompanySchema>;

export const CreateCompanyInputSchema = z.object({
  name: z.string().min(1),
  sector: z.string().optional(),
  tier: z.string().optional(),
  website: z.string().optional(),
});
export type CreateCompanyInput = z.infer<typeof CreateCompanyInputSchema>;

export const UpdateCompanyInputSchema = CreateCompanyInputSchema.partial();
export type UpdateCompanyInput = z.infer<typeof UpdateCompanyInputSchema>;
