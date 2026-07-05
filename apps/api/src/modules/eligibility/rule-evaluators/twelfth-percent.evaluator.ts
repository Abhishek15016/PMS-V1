import { EligibilityEvaluator } from "../eligibility.types";
import { evaluateMinThreshold } from "./threshold.helper";

export const evaluateTwelfthPercent: EligibilityEvaluator = ({
  student,
  criteria,
}) =>
  evaluateMinThreshold({
    ruleCode: "TWELFTH_PERCENT",
    ruleLabel: "12th %",
    actual: student.twelfthPercent,
    expected: criteria.minTwelfthPercent,
    unit: "%",
  });
