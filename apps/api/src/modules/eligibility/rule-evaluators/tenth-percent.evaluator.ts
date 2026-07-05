import { EligibilityEvaluator } from "../eligibility.types";
import { evaluateMinThreshold } from "./threshold.helper";

export const evaluateTenthPercent: EligibilityEvaluator = ({
  student,
  criteria,
}) =>
  evaluateMinThreshold({
    ruleCode: "TENTH_PERCENT",
    ruleLabel: "10th %",
    actual: student.tenthPercent,
    expected: criteria.minTenthPercent,
    unit: "%",
  });
