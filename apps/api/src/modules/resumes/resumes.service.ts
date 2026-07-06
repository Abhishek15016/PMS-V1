import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Resume } from "@pms/db";
import { ResumeContentSchema } from "@pms/types";
import { TenantPrismaService } from "../../database/tenant-prisma.service";

const EMPTY_CONTENT = ResumeContentSchema.parse({});

@Injectable()
export class ResumesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** Returns the student's resume, creating an empty one on first access so
   * the builder always has a row to PUT against. */
  async getOrCreateForUser(tenantId: string, userId: string): Promise<Resume> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const student = await tx.student.findUnique({ where: { userId } });
      if (!student) throw new NotFoundException("No student profile");
      const existing = await tx.resume.findUnique({
        where: { studentId: student.id },
      });
      if (existing) return existing;
      return tx.resume.create({
        data: {
          tenantId,
          studentId: student.id,
          content: EMPTY_CONTENT as Prisma.InputJsonValue,
        },
      });
    });
  }

  async updateForUser(
    tenantId: string,
    userId: string,
    content: unknown,
  ): Promise<Resume> {
    // Zod is the section-shape authority (shared with the web builder).
    const parsed = ResumeContentSchema.parse(content);
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const student = await tx.student.findUnique({ where: { userId } });
      if (!student) throw new NotFoundException("No student profile");
      const existing = await tx.resume.findUnique({
        where: { studentId: student.id },
      });
      if (existing) {
        return tx.resume.update({
          where: { id: existing.id },
          data: { content: parsed as Prisma.InputJsonValue },
        });
      }
      return tx.resume.create({
        data: {
          tenantId,
          studentId: student.id,
          content: parsed as Prisma.InputJsonValue,
        },
      });
    });
  }

  /** Staff view of any student's resume (read-only). */
  async findByStudentId(
    tenantId: string,
    studentId: string,
  ): Promise<Resume | null> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.resume.findUnique({ where: { studentId } }),
    );
  }
}
