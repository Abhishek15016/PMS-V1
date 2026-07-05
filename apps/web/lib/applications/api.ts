import type {
  Application,
  CreateApplicationInput,
  RecordRoundResultInput,
  RoundResult,
} from "@pms/types";
import { apiFetch } from "../api-client";

export function listApplications(driveId?: string): Promise<Application[]> {
  const query = driveId ? `?driveId=${encodeURIComponent(driveId)}` : "";
  return apiFetch<Application[]>(`/applications${query}`);
}

export function createApplication(
  dto: CreateApplicationInput,
): Promise<Application> {
  return apiFetch<Application>("/applications", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function withdrawApplication(id: string): Promise<Application> {
  return apiFetch<Application>(`/applications/${id}/withdraw`, {
    method: "PATCH",
  });
}

export function shortlistApplication(id: string): Promise<Application> {
  return apiFetch<Application>(`/applications/${id}/shortlist`, {
    method: "PATCH",
  });
}

export function recordRoundResult(
  applicationId: string,
  dto: RecordRoundResultInput,
): Promise<RoundResult> {
  return apiFetch<RoundResult>(`/applications/${applicationId}/round-results`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}
