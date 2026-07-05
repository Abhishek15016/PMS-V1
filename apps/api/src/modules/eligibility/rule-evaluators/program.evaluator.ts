import { EligibilityEvaluator } from "../eligibility.types";

/** Empty eligiblePrograms = open to all programs, not "eligible for none" — an explicit product decision, matching SP-16's "no criteria = everyone passes" edge case. */
export const evaluateProgram: EligibilityEvaluator = ({
  student,
  eligiblePrograms,
}) => {
  if (eligiblePrograms.length === 0) {
    return {
      ruleCode: "PROGRAM",
      ruleLabel: "Program/branch",
      passed: true,
      expected: null,
      actual: student.departmentCode,
      message: "This drive is open to all programs",
    };
  }

  const passed = eligiblePrograms.includes(student.departmentCode);
  return {
    ruleCode: "PROGRAM",
    ruleLabel: "Program/branch",
    passed,
    expected: eligiblePrograms,
    actual: student.departmentCode,
    message: passed
      ? `${student.departmentCode} is an eligible program for this drive`
      : `${student.departmentCode} is not among the eligible programs (${eligiblePrograms.join(", ")})`,
  };
};
