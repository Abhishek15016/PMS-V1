import { ApplicationStatus, RoundResultStatus } from "@pms/db";

/**
 * Pure — no I/O. FAIL is always terminal (REJECTED). PASS on the pipeline's
 * last round (by position) is terminal (SELECTED); PASS on any earlier
 * round, or a PENDING result at any round, means the application is still
 * actively progressing (IN_ROUND).
 */
export function deriveApplicationStatusFromRoundResult(
  resultStatus: RoundResultStatus,
  roundPosition: number,
  maxPosition: number,
): ApplicationStatus {
  if (resultStatus === "FAIL") return "REJECTED";
  if (resultStatus === "PENDING") return "IN_ROUND";
  return roundPosition === maxPosition ? "SELECTED" : "IN_ROUND";
}
