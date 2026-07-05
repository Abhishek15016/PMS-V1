import { z } from "zod";
import { EligibilityCriteriaDefinitionSchema } from "./policy-rules";

export const EligibilityReasonSchema = z.object({
  ruleCode: z.string(),
  ruleLabel: z.string(),
  passed: z.boolean(),
  expected: z.unknown(),
  actual: z.unknown(),
  message: z.string(),
});
export type EligibilityReason = z.infer<typeof EligibilityReasonSchema>;

export const EligibilityResultSchema = z.object({
  eligible: z.boolean(),
  reasons: z.array(EligibilityReasonSchema),
});
export type EligibilityResult = z.infer<typeof EligibilityResultSchema>;

export const EvaluateEligibilityInputSchema = z.object({
  studentId: z.string().min(1),
  jdId: z.string().min(1),
});
export type EvaluateEligibilityInput = z.infer<typeof EvaluateEligibilityInputSchema>;

export const EligibilityCandidateSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  departmentCode: z.string(),
});
export type EligibilityCandidate = z.infer<typeof EligibilityCandidateSchema>;

export const IneligibleCandidateSchema = z.object({
  student: EligibilityCandidateSchema,
  reasons: z.array(EligibilityReasonSchema),
});
export type IneligibleCandidate = z.infer<typeof IneligibleCandidateSchema>;

export const DriveEligibilityResultSchema = z.object({
  eligible: z.array(EligibilityCandidateSchema),
  ineligible: z.array(IneligibleCandidateSchema),
  summary: z.object({
    totalEvaluated: z.number(),
    eligibleCount: z.number(),
    ineligibleCount: z.number(),
    fromCache: z.number(),
    freshlyEvaluated: z.number(),
  }),
});
export type DriveEligibilityResult = z.infer<typeof DriveEligibilityResultSchema>;

export const DryRunEligibilityInputSchema = z.object({
  jdId: z.string().min(1),
  proposedCriteria: EligibilityCriteriaDefinitionSchema,
});
export type DryRunEligibilityInput = z.infer<typeof DryRunEligibilityInputSchema>;

export const DryRunResultSchema = z.object({
  current: z.object({ eligibleCount: z.number(), ineligibleCount: z.number() }),
  proposed: z.object({ eligibleCount: z.number(), ineligibleCount: z.number() }),
  newlyEligible: z.array(EligibilityCandidateSchema),
  newlyIneligible: z.array(EligibilityCandidateSchema),
});
export type DryRunResult = z.infer<typeof DryRunResultSchema>;
