import type { CreateJobDescriptionInput, JobDescription } from "@pms/types";
import { apiFetch } from "../api-client";

export function listJobDescriptions(companyId?: string): Promise<JobDescription[]> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  return apiFetch<JobDescription[]>(`/job-descriptions${query}`);
}

export function createJobDescription(dto: CreateJobDescriptionInput): Promise<JobDescription> {
  return apiFetch<JobDescription>("/job-descriptions", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}
