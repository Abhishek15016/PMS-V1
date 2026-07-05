import { Injectable } from "@nestjs/common";
import { Prisma, Student } from "@pms/db";
import { TenantPrismaService } from "../../database/tenant-prisma.service";

export type StudentWithRelations = Prisma.StudentGetPayload<{
  include: { user: true; department: true; batch: true };
}>;

const STUDENT_INCLUDE = { user: true, department: true, batch: true } as const;

/**
 * Data-access layer for Student, the entity SP-16's eligibility engine
 * evaluates against. Kept deliberately thin here (list/get) — full profile
 * editing is SP-07's scope, not this slice's.
 */
@Injectable()
export class StudentsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  findMany(
    tenantId: string,
    filters: { departmentId?: string; batchId?: string } = {},
  ): Promise<StudentWithRelations[]> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.student.findMany({
        where: {
          departmentId: filters.departmentId,
          batchId: filters.batchId,
        },
        include: STUDENT_INCLUDE,
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  findOne(tenantId: string, id: string): Promise<StudentWithRelations | null> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.student.findUnique({ where: { id }, include: STUDENT_INCLUDE }),
    );
  }

  findByUserId(tenantId: string, userId: string): Promise<Student | null> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.student.findUnique({ where: { userId } }),
    );
  }

  findByUserIdWithRelations(
    tenantId: string,
    userId: string,
  ): Promise<StudentWithRelations | null> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.student.findUnique({ where: { userId }, include: STUDENT_INCLUDE }),
    );
  }
}
