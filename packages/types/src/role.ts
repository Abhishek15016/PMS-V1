import { z } from "zod";

export const RoleSchema = z.enum([
  "SUPER_ADMIN",
  "TPO",
  "FACULTY_COORD",
  "STUDENT",
  "RECRUITER",
]);

export type Role = z.infer<typeof RoleSchema>;
