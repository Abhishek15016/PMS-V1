import { EligibilityEvaluator } from "../eligibility.types";

/** allowDiploma unset or true = no restriction; false excludes diploma-entry students. */
export const evaluateDiploma: EligibilityEvaluator = ({
  student,
  criteria,
}) => {
  const { allowDiploma } = criteria;
  if (allowDiploma === undefined || allowDiploma === true) {
    return {
      ruleCode: "DIPLOMA",
      ruleLabel: "Diploma entry",
      passed: true,
      expected: allowDiploma ?? null,
      actual: student.diplomaFlag,
      message: "Diploma-entry students are allowed for this drive",
    };
  }

  const passed = !student.diplomaFlag;
  return {
    ruleCode: "DIPLOMA",
    ruleLabel: "Diploma entry",
    passed,
    expected: false,
    actual: student.diplomaFlag,
    message: passed
      ? "Student is not a diploma entrant"
      : "Diploma-entry students are not eligible for this drive",
  };
};
