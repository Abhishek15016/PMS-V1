import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../auth/auth-store";
import { fetchStudent, listStudents } from "./api";

export function useStudents(params: { departmentId?: string; batchId?: string } = {}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["students", params.departmentId ?? "all", params.batchId ?? "all", accessToken],
    queryFn: () => listStudents(params),
    enabled: hasHydrated && !!accessToken,
    retry: false,
  });
}

export function useStudent(id?: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["students", "detail", id, accessToken],
    queryFn: () => fetchStudent(id!),
    enabled: hasHydrated && !!accessToken && !!id,
    retry: false,
  });
}
