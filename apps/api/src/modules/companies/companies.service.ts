import { Injectable } from "@nestjs/common";
import { Company } from "@pms/db";
import { TenantPrismaService } from "../../database/tenant-prisma.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

@Injectable()
export class CompaniesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  findMany(
    tenantId: string,
    filters: { companyId?: string } = {},
  ): Promise<Company[]> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.company.findMany({
        where: filters.companyId ? { id: filters.companyId } : undefined,
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  findOne(tenantId: string, id: string): Promise<Company | null> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.company.findUnique({ where: { id } }),
    );
  }

  create(tenantId: string, dto: CreateCompanyDto): Promise<Company> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.company.create({ data: { tenantId, ...dto } }),
    );
  }

  update(
    tenantId: string,
    id: string,
    dto: UpdateCompanyDto,
  ): Promise<Company> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.company.update({ where: { id }, data: dto }),
    );
  }
}
