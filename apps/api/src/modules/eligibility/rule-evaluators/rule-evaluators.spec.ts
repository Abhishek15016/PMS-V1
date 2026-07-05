import {
  EligibilityEvaluatorInput,
  EvaluatorStudentInput,
} from "../eligibility.types";
import { evaluateActiveBacklogs } from "./active-backlogs.evaluator";
import { evaluateBacklogHistory } from "./backlog-history.evaluator";
import { evaluateCategory } from "./category.evaluator";
import { evaluateCgpa } from "./cgpa.evaluator";
import { evaluateDebarStatus } from "./debar-status.evaluator";
import { evaluateDiploma } from "./diploma.evaluator";
import { evaluateGapYears } from "./gap-years.evaluator";
import { evaluateProgram } from "./program.evaluator";
import { evaluateTenthPercent } from "./tenth-percent.evaluator";
import { evaluateTwelfthPercent } from "./twelfth-percent.evaluator";
import { runEligibilityEvaluators } from "./index";

const baseStudent: EvaluatorStudentInput = {
  cgpa: 8.0,
  tenthPercent: 90,
  twelfthPercent: 85,
  activeBacklogs: 0,
  backlogHistory: 0,
  gapYears: 0,
  diplomaFlag: false,
  category: "General",
  placementStatus: "UNPLACED",
  departmentCode: "CSE",
};

function makeInput(overrides: {
  student?: Partial<EvaluatorStudentInput>;
  criteria?: EligibilityEvaluatorInput["criteria"];
  eligiblePrograms?: string[];
}): EligibilityEvaluatorInput {
  return {
    student: { ...baseStudent, ...overrides.student },
    criteria: overrides.criteria ?? {},
    eligiblePrograms: overrides.eligiblePrograms ?? [],
  };
}

describe("evaluateCgpa", () => {
  it("passes when no minCgpa is set, regardless of student CGPA", () => {
    expect(evaluateCgpa(makeInput({ student: { cgpa: null } })).passed).toBe(
      true,
    );
  });

  it("fails closed when CGPA is missing but a minimum is required", () => {
    const result = evaluateCgpa(
      makeInput({ student: { cgpa: null }, criteria: { minCgpa: 7 } }),
    );
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/missing/i);
  });

  it("fails when below the minimum", () => {
    expect(
      evaluateCgpa(
        makeInput({ student: { cgpa: 6.4 }, criteria: { minCgpa: 7 } }),
      ).passed,
    ).toBe(false);
  });

  it("passes at exactly the minimum (inclusive boundary)", () => {
    expect(
      evaluateCgpa(
        makeInput({ student: { cgpa: 7 }, criteria: { minCgpa: 7 } }),
      ).passed,
    ).toBe(true);
  });

  it("passes above the minimum", () => {
    expect(
      evaluateCgpa(
        makeInput({ student: { cgpa: 8.5 }, criteria: { minCgpa: 7 } }),
      ).passed,
    ).toBe(true);
  });
});

describe("evaluateTenthPercent / evaluateTwelfthPercent", () => {
  it("10th%: fails closed on missing data when required", () => {
    const result = evaluateTenthPercent(
      makeInput({
        student: { tenthPercent: null },
        criteria: { minTenthPercent: 80 },
      }),
    );
    expect(result.passed).toBe(false);
  });

  it("12th%: passes when unset regardless of value", () => {
    expect(
      evaluateTwelfthPercent(makeInput({ student: { twelfthPercent: null } }))
        .passed,
    ).toBe(true);
  });

  it("12th%: fails below threshold", () => {
    expect(
      evaluateTwelfthPercent(
        makeInput({
          student: { twelfthPercent: 70 },
          criteria: { minTwelfthPercent: 75 },
        }),
      ).passed,
    ).toBe(false);
  });
});

describe("evaluateActiveBacklogs / evaluateBacklogHistory / evaluateGapYears (max-threshold, non-nullable)", () => {
  it("active backlogs: passes when unset", () => {
    expect(
      evaluateActiveBacklogs(makeInput({ student: { activeBacklogs: 5 } }))
        .passed,
    ).toBe(true);
  });

  it("active backlogs: 0 backlogs passes a maxActiveBacklogs=0 policy", () => {
    expect(
      evaluateActiveBacklogs(
        makeInput({
          student: { activeBacklogs: 0 },
          criteria: { maxActiveBacklogs: 0 },
        }),
      ).passed,
    ).toBe(true);
  });

  it("active backlogs: 1 backlog fails a maxActiveBacklogs=0 policy", () => {
    expect(
      evaluateActiveBacklogs(
        makeInput({
          student: { activeBacklogs: 1 },
          criteria: { maxActiveBacklogs: 0 },
        }),
      ).passed,
    ).toBe(false);
  });

  it("backlog history: fails over the limit, passes at the limit", () => {
    expect(
      evaluateBacklogHistory(
        makeInput({
          student: { backlogHistory: 3 },
          criteria: { maxBacklogHistory: 2 },
        }),
      ).passed,
    ).toBe(false);
    expect(
      evaluateBacklogHistory(
        makeInput({
          student: { backlogHistory: 2 },
          criteria: { maxBacklogHistory: 2 },
        }),
      ).passed,
    ).toBe(true);
  });

  it("gap years: fails over the limit", () => {
    expect(
      evaluateGapYears(
        makeInput({ student: { gapYears: 2 }, criteria: { maxGapYears: 1 } }),
      ).passed,
    ).toBe(false);
  });
});

describe("evaluateDiploma", () => {
  it("passes diploma students when allowDiploma is unset", () => {
    expect(
      evaluateDiploma(makeInput({ student: { diplomaFlag: true } })).passed,
    ).toBe(true);
  });

  it("passes diploma students when allowDiploma is explicitly true", () => {
    expect(
      evaluateDiploma(
        makeInput({
          student: { diplomaFlag: true },
          criteria: { allowDiploma: true },
        }),
      ).passed,
    ).toBe(true);
  });

  it("fails diploma students when allowDiploma is false", () => {
    expect(
      evaluateDiploma(
        makeInput({
          student: { diplomaFlag: true },
          criteria: { allowDiploma: false },
        }),
      ).passed,
    ).toBe(false);
  });

  it("passes non-diploma students when allowDiploma is false", () => {
    expect(
      evaluateDiploma(
        makeInput({
          student: { diplomaFlag: false },
          criteria: { allowDiploma: false },
        }),
      ).passed,
    ).toBe(true);
  });
});

describe("evaluateProgram", () => {
  it("passes everyone when eligiblePrograms is empty (open to all)", () => {
    expect(
      evaluateProgram(
        makeInput({
          student: { departmentCode: "MECH" },
          eligiblePrograms: [],
        }),
      ).passed,
    ).toBe(true);
  });

  it("passes a student in an eligible program", () => {
    expect(
      evaluateProgram(
        makeInput({
          student: { departmentCode: "CSE" },
          eligiblePrograms: ["CSE", "ECE"],
        }),
      ).passed,
    ).toBe(true);
  });

  it("fails a student outside the eligible programs", () => {
    expect(
      evaluateProgram(
        makeInput({
          student: { departmentCode: "MECH" },
          eligiblePrograms: ["CSE", "ECE"],
        }),
      ).passed,
    ).toBe(false);
  });
});

describe("evaluateCategory", () => {
  it("passes when unset", () => {
    expect(
      evaluateCategory(makeInput({ student: { category: null } })).passed,
    ).toBe(true);
  });

  it("fails closed when category is missing but restricted", () => {
    expect(
      evaluateCategory(
        makeInput({
          student: { category: null },
          criteria: { allowedCategories: ["OBC"] },
        }),
      ).passed,
    ).toBe(false);
  });

  it("passes a category in the allowed list", () => {
    expect(
      evaluateCategory(
        makeInput({
          student: { category: "OBC" },
          criteria: { allowedCategories: ["OBC", "General"] },
        }),
      ).passed,
    ).toBe(true);
  });

  it("fails a category not in the allowed list", () => {
    expect(
      evaluateCategory(
        makeInput({
          student: { category: "SC" },
          criteria: { allowedCategories: ["General"] },
        }),
      ).passed,
    ).toBe(false);
  });
});

describe("evaluateDebarStatus", () => {
  it("fails a DEBARRED student unconditionally, ignoring every other criterion", () => {
    const result = evaluateDebarStatus(
      makeInput({ student: { placementStatus: "DEBARRED" } }),
    );
    expect(result.passed).toBe(false);
  });

  it.each(["UNPLACED", "PLACED", "OPTED_OUT"] as const)(
    "passes a %s student",
    (placementStatus) => {
      expect(
        evaluateDebarStatus(makeInput({ student: { placementStatus } })).passed,
      ).toBe(true);
    },
  );
});

describe("runEligibilityEvaluators (combination matrix)", () => {
  it("a fully qualified student with no criteria is eligible (SP-16 edge case: no criteria = everyone in eligible programs passes)", () => {
    const result = runEligibilityEvaluators(makeInput({}));
    expect(result.eligible).toBe(true);
    expect(result.reasons.every((r) => r.passed)).toBe(true);
  });

  it("a student failing exactly one criterion is ineligible overall, with only that reason failing", () => {
    const result = runEligibilityEvaluators(
      makeInput({ student: { cgpa: 5 }, criteria: { minCgpa: 7 } }),
    );
    expect(result.eligible).toBe(false);
    const failed = result.reasons.filter((r) => !r.passed);
    expect(failed).toHaveLength(1);
    expect(failed.at(0)?.ruleCode).toBe("CGPA");
  });

  it("a debarred student fails even when every academic criterion is satisfied", () => {
    const result = runEligibilityEvaluators(
      makeInput({
        student: { placementStatus: "DEBARRED" },
        criteria: { minCgpa: 5 },
      }),
    );
    expect(result.eligible).toBe(false);
    expect(
      result.reasons.find((r) => r.ruleCode === "DEBAR_STATUS")?.passed,
    ).toBe(false);
  });

  it("multiple simultaneous failures are all reported, not just the first", () => {
    const result = runEligibilityEvaluators(
      makeInput({
        student: { cgpa: 5, activeBacklogs: 2, departmentCode: "MECH" },
        criteria: { minCgpa: 7, maxActiveBacklogs: 0 },
        eligiblePrograms: ["CSE"],
      }),
    );
    const failedCodes = result.reasons
      .filter((r) => !r.passed)
      .map((r) => r.ruleCode);
    expect(failedCodes.sort()).toEqual(
      ["ACTIVE_BACKLOGS", "CGPA", "PROGRAM"].sort(),
    );
  });

  it("is deterministic: identical input produces byte-identical output across repeated runs", () => {
    const input = makeInput({
      student: { cgpa: 6.8, activeBacklogs: 1, category: "OBC" },
      criteria: {
        minCgpa: 7,
        maxActiveBacklogs: 0,
        allowedCategories: ["General"],
      },
      eligiblePrograms: ["CSE"],
    });
    const first = runEligibilityEvaluators(input);
    const second = runEligibilityEvaluators(input);
    const third = runEligibilityEvaluators(structuredClone(input));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(first)).toBe(JSON.stringify(third));
  });

  it("evaluates all 10 criteria every time (stable reasons array shape)", () => {
    const result = runEligibilityEvaluators(makeInput({}));
    expect(result.reasons).toHaveLength(10);
    expect(result.reasons.map((r) => r.ruleCode)).toEqual([
      "DEBAR_STATUS",
      "PROGRAM",
      "CGPA",
      "TENTH_PERCENT",
      "TWELFTH_PERCENT",
      "ACTIVE_BACKLOGS",
      "BACKLOG_HISTORY",
      "GAP_YEARS",
      "DIPLOMA",
      "CATEGORY",
    ]);
  });
});
