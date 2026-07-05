import { EligibilityEvaluator } from "../eligibility.types";
import { evaluateMinThreshold } from "./threshold.helper";

export const evaluateCgpa: EligibilityEvaluator = ({ student, criteria }) =>
  evaluateMinThreshold({
    ruleCode: "CGPA",
    ruleLabel: "CGPA",
    actual: student.cgpa,
    expected: criteria.minCgpa,
  });
