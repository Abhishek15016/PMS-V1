import type { DryRunEligibilityInput, DryRunResult, EligibilityResult, EvaluateEligibilityInput } from "@pms/types";
import { apiFetch } from "../api-client";

export function evaluateEligibility(dto: EvaluateEligibilityInput): Promise<EligibilityResult> {
  return apiFetch<EligibilityResult>("/eligibility/evaluate", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function dryRunEligibility(dto: DryRunEligibilityInput): Promise<DryRunResult> {
  return apiFetch<DryRunResult>("/eligibility/dry-run", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}
