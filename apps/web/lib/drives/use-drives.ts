import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateRoundInput, UpdateDriveStatusInput } from "@pms/types";
import { useAuthStore } from "../auth/auth-store";
import {
  createDrive,
  createRound,
  fetchDrive,
  fetchDriveEligibility,
  listDrives,
  updateDriveStatus,
} from "./api";

/**
 * Omit `jdId` to list every drive in the tenant (used by the applications drive
 * picker). GET /drives requires `drives.manage`, which STUDENT has no scope for
 * at all — callers rendering this for a student must pass `enabled: false` and
 * fall back to a plain text input instead (see ApplyDialog).
 */
export function useDrives(jdId?: string, enabled = true) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["drives", jdId ?? "all", accessToken],
    queryFn: () => listDrives(jdId),
    enabled: hasHydrated && !!accessToken && enabled,
    retry: false,
  });
}

/** Used by the applications page to resolve an application's round pipeline before recording a result — drives.manage is TPO/Super Admin/Faculty Coordinator only, so this 403s harmlessly for other roles (the caller only renders it for TPO). */
export function useDrive(driveId?: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["drives", "detail", driveId, accessToken],
    queryFn: () => fetchDrive(driveId!),
    enabled: hasHydrated && !!accessToken && !!driveId,
    retry: false,
  });
}

export function useCreateDrive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDrive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drives"] });
    },
  });
}

export function useUpdateDriveStatus(driveId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateDriveStatusInput) => updateDriveStatus(driveId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drives"] });
    },
  });
}

export function useCreateRound(driveId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateRoundInput) => createRound(driveId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drives"] });
    },
  });
}

export function useDriveEligibility(driveId?: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["drives", "eligibility", driveId, accessToken],
    queryFn: () => fetchDriveEligibility(driveId!),
    enabled: hasHydrated && !!accessToken && !!driveId,
    retry: false,
  });
}
