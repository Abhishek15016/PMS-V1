import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatePolicyRuleInput, CreatePolicyRuleVersionInput, PolicyRuleStatus, PolicyRuleType } from "@pms/types";
import { useAuthStore } from "../auth/auth-store";
import { activatePolicyRule, createPolicyRule, createPolicyRuleVersion, listPolicyRules } from "./api";

export function usePolicyRules(params: { type?: PolicyRuleType; status?: PolicyRuleStatus } = {}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["policy-rules", params.type ?? "all", params.status ?? "all", accessToken],
    queryFn: () => listPolicyRules(params),
    enabled: hasHydrated && !!accessToken,
    retry: false,
  });
}

export function useCreatePolicyRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePolicyRuleInput) => createPolicyRule(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy-rules"] });
    },
  });
}

export function useCreatePolicyRuleVersion(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePolicyRuleVersionInput) => createPolicyRuleVersion(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy-rules"] });
    },
  });
}

export function useActivatePolicyRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activatePolicyRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy-rules"] });
    },
  });
}
