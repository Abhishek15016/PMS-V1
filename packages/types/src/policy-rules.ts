import { z } from "zod";

/**
 * One zod schema per PolicyRule.type, matching the master plan §5C list:
 * eligibility-criteria, slab-definition, offer-cap, debar-rule,
 * re-eligibility. These are the shapes stored in PolicyRule.definition
 * (Json) — SP-16's evaluators and SP-17's slab/cap logic both import these
 * schemas directly, so the rule authoring side (this slice) and the
 * rule-consuming side can never silently drift apart.
 *
 * Every field is optional: an eligibility-criteria rule with no fields set
 * means "everyone in an eligible program passes" — explicit, not
 * accidental (SP-16 edge case).
 */

export const EligibilityCriteriaDefinitionSchema = z.object({
  minCgpa: z.number().min(0).max(10).optional(),
  minTenthPercent: z.number().min(0).max(100).optional(),
  minTwelfthPercent: z.number().min(0).max(100).optional(),
  maxActiveBacklogs: z.number().int().min(0).optional(),
  maxBacklogHistory: z.number().int().min(0).optional(),
  maxGapYears: z.number().int().min(0).optional(),
  allowDiploma: z.boolean().optional(),
  allowedCategories: z.array(z.string()).optional(),
});
export type EligibilityCriteriaDefinition = z.infer<typeof EligibilityCriteriaDefinitionSchema>;

/** ctc >= dreamMinCtc -> DREAM; ctc >= superDreamMinCtc -> SUPER_DREAM; else NON_DREAM. */
export const SlabDefinitionSchema = z
  .object({
    superDreamMinCtc: z.number().positive(),
    dreamMinCtc: z.number().positive(),
  })
  .refine((v) => v.dreamMinCtc >= v.superDreamMinCtc, {
    message: "dreamMinCtc must be >= superDreamMinCtc",
  });
export type SlabDefinition = z.infer<typeof SlabDefinitionSchema>;

export const OfferCapDefinitionSchema = z.object({
  oneOfferPerSlabTier: z.boolean(),
});
export type OfferCapDefinition = z.infer<typeof OfferCapDefinitionSchema>;

export const DebarRuleDefinitionSchema = z.object({
  debarOnOfferRejection: z.boolean(),
  maxRejectionsBeforeDebar: z.number().int().min(1).optional(),
});
export type DebarRuleDefinition = z.infer<typeof DebarRuleDefinitionSchema>;

/** Explicit matrix of which slab a student already placed in may still sit for. */
export const ReEligibilityDefinitionSchema = z.object({
  allowDreamAfterNonDream: z.boolean(),
  allowDreamAfterSuperDream: z.boolean(),
  allowSuperDreamAfterNonDream: z.boolean(),
});
export type ReEligibilityDefinition = z.infer<typeof ReEligibilityDefinitionSchema>;

export const POLICY_RULE_DEFINITION_SCHEMAS = {
  ELIGIBILITY_CRITERIA: EligibilityCriteriaDefinitionSchema,
  SLAB_DEFINITION: SlabDefinitionSchema,
  OFFER_CAP: OfferCapDefinitionSchema,
  DEBAR_RULE: DebarRuleDefinitionSchema,
  RE_ELIGIBILITY: ReEligibilityDefinitionSchema,
} as const;

export type PolicyRuleType = keyof typeof POLICY_RULE_DEFINITION_SCHEMAS;

export function validatePolicyRuleDefinition(type: PolicyRuleType, definition: unknown) {
  return POLICY_RULE_DEFINITION_SCHEMAS[type].safeParse(definition);
}

export const PolicyRuleTypeSchema = z.enum([
  "ELIGIBILITY_CRITERIA",
  "SLAB_DEFINITION",
  "OFFER_CAP",
  "DEBAR_RULE",
  "RE_ELIGIBILITY",
]);

export const PolicyRuleStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type PolicyRuleStatus = z.infer<typeof PolicyRuleStatusSchema>;

export const PolicyRuleSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  type: PolicyRuleTypeSchema,
  name: z.string(),
  version: z.number(),
  status: PolicyRuleStatusSchema,
  definition: z.record(z.string(), z.unknown()),
  effectiveFrom: z.string().nullable(),
  supersedesId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const CreatePolicyRuleInputSchema = z.object({
  type: PolicyRuleTypeSchema,
  name: z.string().min(1),
  definition: z.record(z.string(), z.unknown()),
});
export type CreatePolicyRuleInput = z.infer<typeof CreatePolicyRuleInputSchema>;

export const CreatePolicyRuleVersionInputSchema = z.object({
  definition: z.record(z.string(), z.unknown()),
});
export type CreatePolicyRuleVersionInput = z.infer<typeof CreatePolicyRuleVersionInputSchema>;
