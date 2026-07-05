import { EligibilityEvaluator } from "../eligibility.types";
import { evaluateMaxThreshold } from "./threshold.helper";

export const evaluateBacklogHistory: EligibilityEvaluator = ({
  student,
  criteria,
}) =>
  evaluateMaxThreshold({
    ruleCode: "BACKLOG_HISTORY",
    ruleLabel: "Backlog history",
    actual: student.backlogHistory,
    expected: criteria.maxBacklogHistory,
  });
