import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateCompanyInput } from "@pms/types";
import { useAuthStore } from "../auth/auth-store";
import { createCompany, fetchCompany, listCompanies, updateCompany } from "./api";

export function useCompanies() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["companies", accessToken],
    queryFn: listCompanies,
    enabled: hasHydrated && !!accessToken,
    retry: false,
  });
}

export function useCompany(id: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["companies", id, accessToken],
    queryFn: () => fetchCompany(id),
    enabled: hasHydrated && !!accessToken && !!id,
    retry: false,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useUpdateCompany(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCompanyInput) => updateCompany(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}
