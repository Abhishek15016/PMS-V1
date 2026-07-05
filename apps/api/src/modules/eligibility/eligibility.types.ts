import { PlacementStatus } from "@pms/db";
import { EligibilityCriteriaDefinition } from "@pms/types";

export interface EligibilityReason {
  ruleCode: string;
  ruleLabel: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}

/** Flattened, evaluator-friendly view of Student — decouples the pure evaluators from Prisma's shape. */
export interface EvaluatorStudentInput {
  cgpa: number | null;
  tenthPercent: number | null;
  twelfthPercent: number | null;
  activeBacklogs: number;
  backlogHistory: number;
  gapYears: number;
  diplomaFlag: boolean;
  category: string | null;
  placementStatus: PlacementStatus;
  departmentCode: string;
}

export interface EligibilityEvaluatorInput {
  student: EvaluatorStudentInput;
  criteria: EligibilityCriteriaDefinition;
  eligiblePrograms: string[];
}

export type EligibilityEvaluator = (
  input: EligibilityEvaluatorInput,
) => EligibilityReason;

export interface EligibilityResult {
  eligible: boolean;
  reasons: EligibilityReason[];
}
