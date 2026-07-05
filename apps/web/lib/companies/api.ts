import type { Company, CreateCompanyInput, UpdateCompanyInput } from "@pms/types";
import { apiFetch } from "../api-client";

export function listCompanies(): Promise<Company[]> {
  return apiFetch<Company[]>("/companies");
}

export function fetchCompany(id: string): Promise<Company> {
  return apiFetch<Company>(`/companies/${id}`);
}

export function createCompany(dto: CreateCompanyInput): Promise<Company> {
  return apiFetch<Company>("/companies", { method: "POST", body: JSON.stringify(dto) });
}

export function updateCompany(id: string, dto: UpdateCompanyInput): Promise<Company> {
  return apiFetch<Company>(`/companies/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
}
