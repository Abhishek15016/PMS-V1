import type { AuthResult, MeResponse } from "@pms/types";
import { apiFetch } from "../api-client";

export function ssoCallback(tenantSlug: string, email: string): Promise<AuthResult> {
  return apiFetch<AuthResult>("/auth/sso/callback", {
    method: "POST",
    body: JSON.stringify({ tenantSlug, email }),
  });
}

export function requestMagicLink(tenantSlug: string, email: string): Promise<void> {
  return apiFetch<void>("/auth/magic-link/request", {
    method: "POST",
    body: JSON.stringify({ tenantSlug, email }),
  });
}

export function verifyMagicLink(token: string): Promise<AuthResult> {
  return apiFetch<AuthResult>("/auth/magic-link/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

/** Dev-only convenience — see AuthDevController; always 404s against a real email provider. */
export function fetchDevMagicLinkToken(email: string): Promise<{ token: string }> {
  return apiFetch(`/auth/dev/magic-link?email=${encodeURIComponent(email)}`);
}

export function logout(refreshToken: string): Promise<void> {
  return apiFetch<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me");
}
