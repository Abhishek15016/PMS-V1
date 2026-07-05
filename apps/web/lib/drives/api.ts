import type {
  CreateDriveInput,
  CreateRoundInput,
  Drive,
  DriveEligibilityResult,
  Round,
  UpdateDriveStatusInput,
} from "@pms/types";
import { apiFetch } from "../api-client";

export function listDrives(jdId?: string): Promise<Drive[]> {
  const query = jdId ? `?jdId=${encodeURIComponent(jdId)}` : "";
  return apiFetch<Drive[]>(`/drives${query}`);
}

export function fetchDrive(id: string): Promise<Drive> {
  return apiFetch<Drive>(`/drives/${id}`);
}

export function createDrive(dto: CreateDriveInput): Promise<Drive> {
  return apiFetch<Drive>("/drives", { method: "POST", body: JSON.stringify(dto) });
}

export function updateDriveStatus(id: string, dto: UpdateDriveStatusInput): Promise<Drive> {
  return apiFetch<Drive>(`/drives/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export function createRound(driveId: string, dto: CreateRoundInput): Promise<Round> {
  return apiFetch<Round>(`/drives/${driveId}/rounds`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function fetchDriveEligibility(driveId: string): Promise<DriveEligibilityResult> {
  return apiFetch<DriveEligibilityResult>(`/drives/${driveId}/eligibility`);
}
