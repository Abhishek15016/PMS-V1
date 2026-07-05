import { z } from "zod";
import { RoleSchema } from "./role";

export const PublicUserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: RoleSchema,
  departmentId: z.string().nullable(),
  companyId: z.string().nullable(),
});

export type PublicUser = z.infer<typeof PublicUserSchema>;
