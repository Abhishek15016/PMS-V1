import {
  EligibilityEvaluator,
  EligibilityEvaluatorInput,
  EligibilityResult,
} from "../eligibility.types";
import { evaluateActiveBacklogs } from "./active-backlogs.evaluator";
import { evaluateBacklogHistory } from "./backlog-history.evaluator";
import { evaluateCategory } from "./category.evaluator";
import { evaluateCgpa } from "./cgpa.evaluator";
import { evaluateDebarStatus } from "./debar-status.evaluator";
import { evaluateDiploma } from "./diploma.evaluator";
import { evaluateGapYears } from "./gap-years.evaluator";
import { evaluateProgram } from "./program.evaluator";
import { evaluateTenthPercent } from "./tenth-percent.evaluator";
import { evaluateTwelfthPercent } from "./twelfth-percent.evaluator";

/**
 * Order is stable and deterministic — the reasons array is byte-identical
 * for identical inputs (SP-16's determinism requirement), including order.
 */
export const ELIGIBILITY_EVALUATORS: EligibilityEvaluator[] = [
  evaluateDebarStatus,
  evaluateProgram,
  evaluateCgpa,
  evaluateTenthPercent,
  evaluateTwelfthPercent,
  evaluateActiveBacklogs,
  evaluateBacklogHistory,
  evaluateGapYears,
  evaluateDiploma,
  evaluateCategory,
];

/** Pure — no I/O, no randomness, no clock reads. Same input always produces the same output. */
export function runEligibilityEvaluators(
  input: EligibilityEvaluatorInput,
): EligibilityResult {
  const reasons = ELIGIBILITY_EVALUATORS.map((evaluate) => evaluate(input));
  return {
    eligible: reasons.every((r) => r.passed),
    reasons,
  };
}

export * from "./active-backlogs.evaluator";
export * from "./backlog-history.evaluator";
export * from "./category.evaluator";
export * from "./cgpa.evaluator";
export * from "./debar-status.evaluator";
export * from "./diploma.evaluator";
export * from "./gap-years.evaluator";
export * from "./program.evaluator";
export * from "./tenth-percent.evaluator";
export * from "./twelfth-percent.evaluator";
