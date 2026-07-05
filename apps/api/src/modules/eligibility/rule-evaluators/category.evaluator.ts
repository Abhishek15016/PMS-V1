import { EligibilityEvaluator } from "../eligibility.types";

export const evaluateCategory: EligibilityEvaluator = ({
  student,
  criteria,
}) => {
  const { allowedCategories } = criteria;
  if (allowedCategories === undefined) {
    return {
      ruleCode: "CATEGORY",
      ruleLabel: "Category",
      passed: true,
      expected: null,
      actual: student.category,
      message: "No category restriction for this drive",
    };
  }

  if (student.category === null) {
    return {
      ruleCode: "CATEGORY",
      ruleLabel: "Category",
      passed: false,
      expected: allowedCategories,
      actual: null,
      message: "Student's category is missing from their academic record",
    };
  }

  const passed = allowedCategories.includes(student.category);
  return {
    ruleCode: "CATEGORY",
    ruleLabel: "Category",
    passed,
    expected: allowedCategories,
    actual: student.category,
    message: passed
      ? `Category "${student.category}" is eligible for this drive`
      : `Category "${student.category}" is not among the eligible categories (${allowedCategories.join(", ")})`,
  };
};
