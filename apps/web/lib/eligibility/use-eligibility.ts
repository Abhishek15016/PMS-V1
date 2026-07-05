import { useMutation } from "@tanstack/react-query";
import { dryRunEligibility, evaluateEligibility } from "./api";

export function useEvaluateEligibility() {
  return useMutation({ mutationFn: evaluateEligibility });
}

export function useDryRunEligibility() {
  return useMutation({ mutationFn: dryRunEligibility });
}
