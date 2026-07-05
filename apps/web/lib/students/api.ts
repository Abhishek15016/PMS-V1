import type { Student } from "@pms/types";
import { apiFetch } from "../api-client";

export function listStudents(params: { departmentId?: string; batchId?: string } = {}): Promise<Student[]> {
  const search = new URLSearchParams();
  if (params.departmentId) search.set("departmentId", params.departmentId);
  if (params.batchId) search.set("batchId", params.batchId);
  const query = search.toString();
  return apiFetch<Student[]>(`/students${query ? `?${query}` : ""}`);
}

export function fetchStudent(id: string): Promise<Student> {
  return apiFetch<Student>(`/students/${id}`);
}
