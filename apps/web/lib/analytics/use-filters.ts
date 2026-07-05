import { create } from "zustand";

interface FiltersState {
  batchId: string | null;
  departmentId: string | null;
  setBatchId: (batchId: string | null) => void;
  setDepartmentId: (departmentId: string | null) => void;
}

/** Session-only (no persistence) — re-picking a batch/branch every visit is fine for an internal dashboard; unlike auth, this isn't identity that should survive a refresh in a confusing way. */
export const useFilters = create<FiltersState>((set) => ({
  batchId: null,
  departmentId: null,
  setBatchId: (batchId) => set({ batchId }),
  setDepartmentId: (departmentId) => set({ departmentId }),
}));
