import { Injectable } from "@nestjs/common";
import { TenantPrismaService } from "../../database/tenant-prisma.service";

export interface RecruiterSummaryResponse {
  scope: "RECRUITER";
  companyId: string;
  offersPending: number;
  offersExtended: number;
  offersAccepted: number;
  offersRejected: number;
}

/**
 * A recruiter's "SELF" analytics scope has no batch/department dimension —
 * it means "my own company's offers," which PlacementSummary doesn't model
 * at all (Offer -> Application -> Drive -> JD is the only path to a
 * company, and PPOs have no Application, so they're excluded here; a
 * recruiter can't take credit for PPOs anyway since those are TPO-initiated
 * conversions, not something the recruiter extended). Computed live, not
 * from the cached summary — a fundamentally different shape from the
 * batch-scoped KPI dashboard, not a variant of it.
 */
@Injectable()
export class RecruiterAnalyticsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getSummary(
    tenantId: string,
    companyId: string,
  ): Promise<RecruiterSummaryResponse> {
    const [offersPending, offersExtended, offersAccepted, offersRejected] =
      await this.tenantPrisma.run(tenantId, (tx) => {
        const companyFilter = {
          tenantId,
          application: { drive: { jobDescription: { companyId } } },
        } as const;
        return Promise.all([
          tx.offer.count({ where: { ...companyFilter, status: "PENDING" } }),
          tx.offer.count({ where: { ...companyFilter, status: "EXTENDED" } }),
          tx.offer.count({ where: { ...companyFilter, status: "ACCEPTED" } }),
          tx.offer.count({ where: { ...companyFilter, status: "REJECTED" } }),
        ]);
      });

    return {
      scope: "RECRUITER",
      companyId,
      offersPending,
      offersExtended,
      offersAccepted,
      offersRejected,
    };
  }
}
