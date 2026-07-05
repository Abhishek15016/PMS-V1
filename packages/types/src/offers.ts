import { z } from "zod";
import { SlabSchema } from "./job-descriptions";

export const OfferStatusSchema = z.enum([
  "PENDING",
  "EXTENDED",
  "ACCEPTED",
  "REJECTED",
  "REVOKED",
]);
export type OfferStatus = z.infer<typeof OfferStatusSchema>;

export const OfferApplicationSchema = z.object({
  id: z.string(),
  drive: z.object({
    id: z.string(),
    jobDescription: z.object({
      id: z.string(),
      title: z.string(),
      companyId: z.string(),
    }),
  }),
});

export const OfferSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  studentId: z.string(),
  applicationId: z.string().nullable(),
  ctcLpa: z.number(),
  slab: SlabSchema.nullable(),
  status: OfferStatusSchema,
  isPpo: z.boolean(),
  sourceInternshipId: z.string().nullable(),
  extendedAt: z.string(),
  respondedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  application: OfferApplicationSchema.nullable(),
});
export type Offer = z.infer<typeof OfferSchema>;

export const CreateOfferInputSchema = z.object({
  applicationId: z.string().min(1),
  ctcLpa: z.number().positive(),
});
export type CreateOfferInput = z.infer<typeof CreateOfferInputSchema>;

export const CreatePpoOfferInputSchema = z.object({
  studentId: z.string().min(1),
  sourceInternshipId: z.string().min(1),
  ctcLpa: z.number().positive(),
});
export type CreatePpoOfferInput = z.infer<typeof CreatePpoOfferInputSchema>;
