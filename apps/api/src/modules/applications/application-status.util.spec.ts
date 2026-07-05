import { deriveApplicationStatusFromRoundResult } from "./application-status.util";

describe("deriveApplicationStatusFromRoundResult", () => {
  it("FAIL is always REJECTED, regardless of round position", () => {
    expect(deriveApplicationStatusFromRoundResult("FAIL", 1, 3)).toBe(
      "REJECTED",
    );
    expect(deriveApplicationStatusFromRoundResult("FAIL", 3, 3)).toBe(
      "REJECTED",
    );
  });

  it("PENDING is always IN_ROUND, regardless of round position", () => {
    expect(deriveApplicationStatusFromRoundResult("PENDING", 1, 3)).toBe(
      "IN_ROUND",
    );
    expect(deriveApplicationStatusFromRoundResult("PENDING", 3, 3)).toBe(
      "IN_ROUND",
    );
  });

  it("PASS on a non-final round is IN_ROUND", () => {
    expect(deriveApplicationStatusFromRoundResult("PASS", 1, 3)).toBe(
      "IN_ROUND",
    );
    expect(deriveApplicationStatusFromRoundResult("PASS", 2, 3)).toBe(
      "IN_ROUND",
    );
  });

  it("PASS on the pipeline's final round is SELECTED", () => {
    expect(deriveApplicationStatusFromRoundResult("PASS", 3, 3)).toBe(
      "SELECTED",
    );
  });

  it("PASS on a single-round pipeline is SELECTED", () => {
    expect(deriveApplicationStatusFromRoundResult("PASS", 1, 1)).toBe(
      "SELECTED",
    );
  });
});
