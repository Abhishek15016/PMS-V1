import { useRouter } from "next/navigation";
import { useAuthStore } from "./auth-store";
import { logout as logoutRequest } from "./api";

export function useLogout() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  return async function logout() {
    if (refreshToken) {
      // Best-effort — the session is cleared client-side regardless of
      // whether the revoke call succeeds (e.g. network offline).
      await logoutRequest(refreshToken).catch(() => undefined);
    }
    clear();
    router.replace("/login");
  };
}
