import { z } from "zod";
import { PublicUserSchema } from "./user";

export const AuthResultSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: PublicUserSchema,
});

export type AuthResult = z.infer<typeof AuthResultSchema>;

export const MeResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  role: PublicUserSchema.shape.role,
  departmentId: z.string().nullable(),
  companyId: z.string().nullable(),
  permissions: z.array(z.string()),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;
