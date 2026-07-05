import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicUser } from "@pms/types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: PublicUser | null;
  hasHydrated: boolean;
  setSession: (session: { accessToken: string; refreshToken: string; user: PublicUser }) => void;
  setAccessToken: (accessToken: string) => void;
  setHasHydrated: (value: boolean) => void;
  clear: () => void;
}

/**
 * Client-side token storage (localStorage via zustand persist), not httpOnly
 * cookies — a deliberate dev-stage tradeoff since apps/api is a separate
 * origin from apps/web with no BFF proxy yet. Revisit if/when Next starts
 * proxying API calls (master plan §3 calls Next "SSR + BFF").
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,
      setSession: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: "pms-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
