import { EligibilityEvaluator } from "../eligibility.types";
import { evaluateMaxThreshold } from "./threshold.helper";

export const evaluateActiveBacklogs: EligibilityEvaluator = ({
  student,
  criteria,
}) =>
  evaluateMaxThreshold({
    ruleCode: "ACTIVE_BACKLOGS",
    ruleLabel: "Active backlogs",
    actual: student.activeBacklogs,
    expected: criteria.maxActiveBacklogs,
  });
