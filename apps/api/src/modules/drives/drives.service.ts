import { Injectable } from "@nestjs/common";
import { Drive, DriveStatus, Prisma, Round } from "@pms/db";
import { TenantPrismaService } from "../../database/tenant-prisma.service";
import { CreateRoundDto } from "./dto/create-round.dto";

export type DriveWithRounds = Prisma.DriveGetPayload<{
  include: { rounds: true; jobDescription: true };
}>;

const DRIVE_INCLUDE = { rounds: true, jobDescription: true } as const;

@Injectable()
export class DrivesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  findMany(
    tenantId: string,
    filters: { jdId?: string; statuses?: DriveStatus[] } = {},
  ): Promise<DriveWithRounds[]> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.drive.findMany({
        where: {
          jdId: filters.jdId,
          status: filters.statuses ? { in: filters.statuses } : undefined,
        },
        include: DRIVE_INCLUDE,
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  findOne(tenantId: string, id: string): Promise<DriveWithRounds | null> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.drive.findUnique({ where: { id }, include: DRIVE_INCLUDE }),
    );
  }

  create(
    tenantId: string,
    dto: { jdId: string; status?: DriveStatus; scheduledAt?: string },
  ): Promise<Drive> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.drive.create({
        data: {
          tenantId,
          jdId: dto.jdId,
          status: dto.status,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        },
      }),
    );
  }

  updateStatus(
    tenantId: string,
    id: string,
    status: DriveStatus,
  ): Promise<Drive> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.drive.update({ where: { id }, data: { status } }),
    );
  }

  createRound(
    tenantId: string,
    driveId: string,
    dto: CreateRoundDto,
  ): Promise<Round> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.round.create({
        data: {
          tenantId,
          driveId,
          type: dto.type,
          position: dto.position,
          mode: dto.mode,
          cutoff: dto.cutoff,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        },
      }),
    );
  }
}
