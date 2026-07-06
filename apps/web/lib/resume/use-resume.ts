import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ResumeContent, UpdateStudentLinksInput } from "@pms/types";
import { useAuthStore } from "../auth/auth-store";
import { fetchMyResume, updateMyLinks, updateMyResume } from "./api";

export function useMyResume(enabled = true) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  return useQuery({
    queryKey: ["resume", "me", accessToken],
    queryFn: fetchMyResume,
    enabled: hasHydrated && !!accessToken && enabled,
    retry: false,
  });
}

export function useUpdateMyResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: ResumeContent) => updateMyResume(content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resume", "me"] });
    },
  });
}

export function useUpdateMyLinks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (links: UpdateStudentLinksInput) => updateMyLinks(links),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
