import { ConflictException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Prisma } from "@pms/db";
import { TenantPrismaService } from "../../database/tenant-prisma.service";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/**
 * Tenant self-provisioning. No RLS bypass and no privileged role: the
 * institutions policy is `id = current_setting('app.tenant_id')` WITH CHECK
 * included, so generating the tenant id up front and running the whole
 * bootstrap inside TenantPrismaService.run(newId, …) inserts the root row
 * and its first SUPER_ADMIN while remaining provably unable to read or
 * write any other tenant. Slug collisions surface as the DB's unique
 * violation — no cross-tenant existence lookup is ever performed.
 */
@Injectable()
export class InstitutionsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async register(input: {
    institutionName: string;
    adminName: string;
    adminEmail: string;
  }): Promise<{ institutionId: string; slug: string; adminEmail: string }> {
    const institutionId = randomUUID();
    const slug = slugify(input.institutionName);
    if (slug.length < 3) {
      throw new ConflictException(
        "Institution name must contain at least a few letters or digits",
      );
    }

    try {
      await this.tenantPrisma.run(institutionId, async (tx) => {
        await tx.institution.create({
          data: { id: institutionId, name: input.institutionName.trim(), slug },
        });
        await tx.user.create({
          data: {
            tenantId: institutionId,
            email: input.adminEmail.toLowerCase().trim(),
            displayName: input.adminName.trim(),
            role: "SUPER_ADMIN",
            authProvider: "stub",
            status: "ACTIVE",
          },
        });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          "An institution with a matching name is already registered — pick a more specific name",
        );
      }
      throw err;
    }

    return { institutionId, slug, adminEmail: input.adminEmail.toLowerCase().trim() };
  }
}
