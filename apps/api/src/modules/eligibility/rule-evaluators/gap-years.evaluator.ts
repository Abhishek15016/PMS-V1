import { EligibilityEvaluator } from "../eligibility.types";
import { evaluateMaxThreshold } from "./threshold.helper";

export const evaluateGapYears: EligibilityEvaluator = ({ student, criteria }) =>
  evaluateMaxThreshold({
    ruleCode: "GAP_YEARS",
    ruleLabel: "Gap years",
    actual: student.gapYears,
    expected: criteria.maxGapYears,
  });
