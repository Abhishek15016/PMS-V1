import { z } from "zod";

export const RegisterInstitutionInputSchema = z.object({
  institutionName: z.string().min(3).max(120),
  adminName: z.string().min(2).max(80),
  adminEmail: z.string().email(),
});
export type RegisterInstitutionInput = z.infer<typeof RegisterInstitutionInputSchema>;

export const RegisterInstitutionResultSchema = z.object({
  institutionId: z.string(),
  slug: z.string(),
  adminEmail: z.string(),
});
export type RegisterInstitutionResult = z.infer<typeof RegisterInstitutionResultSchema>;

/** Vendor operator console: one row per client institute, counts only. */
export const InstitutionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  createdAt: z.string(),
  counts: z.object({
    students: z.number(),
    users: z.number(),
    companies: z.number(),
    drives: z.number(),
    acceptedOffers: z.number(),
  }),
});
export type InstitutionSummary = z.infer<typeof InstitutionSummarySchema>;
