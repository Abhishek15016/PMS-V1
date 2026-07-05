import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateApplicationInput, RecordRoundResultInput } from "@pms/types";
import { useAuthStore } from "../auth/auth-store";
import {
  createApplication,
  listApplications,
  recordRoundResult,
  shortlistApplication,
  withdrawApplication,
} from "./api";

export function useApplications(driveId?: string, enabled = true) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["applications", driveId ?? "all", accessToken],
    queryFn: () => listApplications(driveId),
    enabled: hasHydrated && !!accessToken && enabled,
    retry: false,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateApplicationInput) => createApplication(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

export function useWithdrawApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withdrawApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

export function useShortlistApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shortlistApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

export function useRecordRoundResult(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordRoundResultInput) =>
      recordRoundResult(applicationId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}
