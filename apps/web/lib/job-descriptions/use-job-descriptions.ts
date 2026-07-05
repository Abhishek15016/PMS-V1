import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../auth/auth-store";
import { createJobDescription, listJobDescriptions } from "./api";

export function useJobDescriptions(companyId?: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["job-descriptions", companyId ?? "all", accessToken],
    queryFn: () => listJobDescriptions(companyId),
    enabled: hasHydrated && !!accessToken,
    retry: false,
  });
}

export function useCreateJobDescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createJobDescription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-descriptions"] });
    },
  });
}
