import { Injectable } from "@nestjs/common";
import { JobDescription } from "@pms/db";
import { TenantPrismaService } from "../../database/tenant-prisma.service";
import { SlabService } from "../offers/slab.service";
import { CreateJobDescriptionDto } from "./dto/create-job-description.dto";

@Injectable()
export class JobDescriptionsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly slabService: SlabService,
  ) {}

  findMany(
    tenantId: string,
    filters: { companyId?: string } = {},
  ): Promise<JobDescription[]> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.jobDescription.findMany({
        where: { companyId: filters.companyId },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  findOne(tenantId: string, id: string): Promise<JobDescription | null> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.jobDescription.findUnique({ where: { id } }),
    );
  }

  /** slab is always derived (SP-17), never client-supplied — see CreateJobDescriptionDto, which has no slab field at all. Null if the institution hasn't configured a SLAB_DEFINITION policy yet. */
  async create(
    tenantId: string,
    dto: CreateJobDescriptionDto,
  ): Promise<JobDescription> {
    const slab = await this.slabService.classifyForTenant(tenantId, dto.ctcLpa);
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.jobDescription.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          title: dto.title,
          ctcLpa: dto.ctcLpa,
          slab,
          eligiblePrograms: dto.eligiblePrograms,
          minCriteria: dto.minCriteria as object,
          location: dto.location,
          bondMonths: dto.bondMonths,
        },
      }),
    );
  }
}
