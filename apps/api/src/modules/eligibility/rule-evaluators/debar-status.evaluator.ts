import { EligibilityEvaluator } from "../eligibility.types";

/** Always evaluated, regardless of criteria — a debarred student fails every drive, unconditionally. */
export const evaluateDebarStatus: EligibilityEvaluator = ({ student }) => {
  const passed = student.placementStatus !== "DEBARRED";
  return {
    ruleCode: "DEBAR_STATUS",
    ruleLabel: "Debar status",
    passed,
    expected: "not DEBARRED",
    actual: student.placementStatus,
    message: passed
      ? "Student is not debarred"
      : "Student is debarred from participating in any drive",
  };
};
