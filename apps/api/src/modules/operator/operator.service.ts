import { BadRequestException, Injectable } from "@nestjs/common";
import type { InstitutionSummary } from "@pms/types";
import { OperatorPrismaService } from "./operator-prisma.service";

@Injectable()
export class OperatorService {
  constructor(private readonly operatorPrisma: OperatorPrismaService) {}

  /** Every client institute with its headline usage counts — the vendor's
   * book of business. Counts only; the operator never reads tenant records
   * themselves through this console. */
  async listInstitutions(): Promise<InstitutionSummary[]> {
    const prisma = this.operatorPrisma.prisma;
    const [institutions, students, users, companies, drives, offers] =
      await Promise.all([
        prisma.institution.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.student.groupBy({ by: ["tenantId"], _count: { id: true } }),
        prisma.user.groupBy({ by: ["tenantId"], _count: { id: true } }),
        prisma.company.groupBy({ by: ["tenantId"], _count: { id: true } }),
        prisma.drive.groupBy({ by: ["tenantId"], _count: { id: true } }),
        prisma.offer.groupBy({
          by: ["tenantId"],
          where: { status: "ACCEPTED" },
          _count: { id: true },
        }),
      ]);

    const countMap = (rows: Array<{ tenantId: string; _count: { id: number } }>) =>
      new Map(rows.map((r) => [r.tenantId, r._count.id]));
    const s = countMap(students);
    const u = countMap(users);
    const c = countMap(companies);
    const d = countMap(drives);
    const o = countMap(offers);

    return institutions.map((inst) => ({
      id: inst.id,
      name: inst.name,
      slug: inst.slug,
      status: inst.status,
      createdAt: inst.createdAt.toISOString(),
      counts: {
        students: s.get(inst.id) ?? 0,
        users: u.get(inst.id) ?? 0,
        companies: c.get(inst.id) ?? 0,
        drives: d.get(inst.id) ?? 0,
        acceptedOffers: o.get(inst.id) ?? 0,
      },
    }));
  }

  async setStatus(id: string, status: string): Promise<InstitutionSummary> {
    if (status !== "ACTIVE" && status !== "SUSPENDED") {
      throw new BadRequestException("status must be ACTIVE or SUSPENDED");
    }
    const prisma = this.operatorPrisma.prisma;
    const inst = await prisma.institution.update({
      where: { id },
      data: { status },
    });
    return {
      id: inst.id,
      name: inst.name,
      slug: inst.slug,
      status: inst.status,
      createdAt: inst.createdAt.toISOString(),
      counts: { students: 0, users: 0, companies: 0, drives: 0, acceptedOffers: 0 },
    };
  }
}
