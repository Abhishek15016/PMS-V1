import type {
  RegisterInstitutionInput,
  RegisterInstitutionResult,
  Resume,
  ResumeContent,
  Student,
  UpdateStudentLinksInput,
} from "@pms/types";
import { apiFetch } from "../api-client";

export function fetchMyResume(): Promise<Resume> {
  return apiFetch<Resume>("/resumes/me");
}

export function updateMyResume(content: ResumeContent): Promise<Resume> {
  return apiFetch<Resume>("/resumes/me", {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export function updateMyLinks(links: UpdateStudentLinksInput): Promise<Student> {
  return apiFetch<Student>("/students/me/links", {
    method: "PATCH",
    body: JSON.stringify(links),
  });
}

export function registerInstitution(
  input: RegisterInstitutionInput,
): Promise<RegisterInstitutionResult> {
  return apiFetch<RegisterInstitutionResult>("/institutions/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
