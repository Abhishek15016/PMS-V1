import type {
  CreatePolicyRuleInput,
  CreatePolicyRuleVersionInput,
  PolicyRule,
  PolicyRuleStatus,
  PolicyRuleType,
} from "@pms/types";
import { apiFetch } from "../api-client";

export function listPolicyRules(params: { type?: PolicyRuleType; status?: PolicyRuleStatus } = {}): Promise<PolicyRule[]> {
  const search = new URLSearchParams();
  if (params.type) search.set("type", params.type);
  if (params.status) search.set("status", params.status);
  const query = search.toString();
  return apiFetch<PolicyRule[]>(`/policy-rules${query ? `?${query}` : ""}`);
}

export function fetchPolicyRule(id: string): Promise<PolicyRule> {
  return apiFetch<PolicyRule>(`/policy-rules/${id}`);
}

export function createPolicyRule(dto: CreatePolicyRuleInput): Promise<PolicyRule> {
  return apiFetch<PolicyRule>("/policy-rules", { method: "POST", body: JSON.stringify(dto) });
}

export function createPolicyRuleVersion(
  id: string,
  dto: CreatePolicyRuleVersionInput,
): Promise<PolicyRule> {
  return apiFetch<PolicyRule>(`/policy-rules/${id}/versions`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function activatePolicyRule(id: string): Promise<PolicyRule> {
  return apiFetch<PolicyRule>(`/policy-rules/${id}/activate`, { method: "POST" });
}
