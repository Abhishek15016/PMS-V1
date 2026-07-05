import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "./auth-store";
import { fetchMe } from "./api";

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["me", accessToken],
    queryFn: fetchMe,
    enabled: hasHydrated && !!accessToken,
    retry: false,
  });
}
