import { EligibilityReason } from "../eligibility.types";

/** Shared shape for "student's numeric value must be >= a minimum" checks (CGPA, 10th%, 12th%) — nullable field, missing data fails closed. */
export function evaluateMinThreshold(params: {
  ruleCode: string;
  ruleLabel: string;
  actual: number | null;
  expected: number | undefined;
  unit?: string;
}): EligibilityReason {
  const { ruleCode, ruleLabel, actual, expected, unit = "" } = params;

  if (expected === undefined) {
    return {
      ruleCode,
      ruleLabel,
      passed: true,
      expected: null,
      actual,
      message: `No ${ruleLabel.toLowerCase()} requirement for this drive`,
    };
  }

  if (actual === null) {
    return {
      ruleCode,
      ruleLabel,
      passed: false,
      expected,
      actual: null,
      message: `${ruleLabel} is missing from the student's academic record`,
    };
  }

  const passed = actual >= expected;
  return {
    ruleCode,
    ruleLabel,
    passed,
    expected,
    actual,
    message: passed
      ? `${ruleLabel} ${actual}${unit} meets the minimum of ${expected}${unit}`
      : `${ruleLabel} ${actual}${unit} is below the required ${expected}${unit}`,
  };
}

/** Shared shape for "student's count must be <= a maximum" checks (backlogs, gap years) — non-nullable, defaults to 0, so there's no missing-data case. */
export function evaluateMaxThreshold(params: {
  ruleCode: string;
  ruleLabel: string;
  actual: number;
  expected: number | undefined;
}): EligibilityReason {
  const { ruleCode, ruleLabel, actual, expected } = params;

  if (expected === undefined) {
    return {
      ruleCode,
      ruleLabel,
      passed: true,
      expected: null,
      actual,
      message: `No ${ruleLabel.toLowerCase()} limit for this drive`,
    };
  }

  const passed = actual <= expected;
  return {
    ruleCode,
    ruleLabel,
    passed,
    expected,
    actual,
    message: passed
      ? `${ruleLabel} ${actual} is within the allowed ${expected}`
      : `${ruleLabel} ${actual} exceeds the allowed ${expected}`,
  };
}
