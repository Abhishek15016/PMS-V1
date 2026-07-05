import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  Application,
  Drive,
  JobDescription,
  Offer,
  OfferStatus,
  Slab,
} from "@pms/db";
import { DebarRuleDefinitionSchema } from "@pms/types";
import {
  TenantPrismaService,
  TenantTx,
} from "../../database/tenant-prisma.service";
import { PermissionScope } from "../rbac/permission.types";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { CreatePpoOfferDto } from "./dto/create-ppo-offer.dto";
import { checkOfferEligibility, ExistingOffer } from "./offer-eligibility.util";
import { SlabService } from "./slab.service";

/** Well-known PolicyRule name, same convention as slab/eligibility rules. */
export const DEBAR_RULE_NAME = "institution-default-debar-rule";

export type OfferWithRelations = Offer & {
  application:
    | (Application & { drive: Drive & { jobDescription: JobDescription } })
    | null;
};

@Injectable()
export class OffersService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly slabService: SlabService,
    private readonly events: EventEmitter2,
  ) {}

  private readonly include = {
    application: { include: { drive: { include: { jobDescription: true } } } },
  } as const;

  findMany(
    tenantId: string,
    filters: {
      studentId?: string;
      studentUserId?: string;
      companyId?: string;
    } = {},
  ): Promise<OfferWithRelations[]> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.offer.findMany({
        where: {
          studentId: filters.studentId,
          ...(filters.studentUserId
            ? { student: { userId: filters.studentUserId } }
            : {}),
          ...(filters.companyId
            ? {
                application: {
                  drive: { jobDescription: { companyId: filters.companyId } },
                },
              }
            : {}),
        },
        include: this.include,
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  findOne(tenantId: string, id: string): Promise<OfferWithRelations | null> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.offer.findUnique({ where: { id }, include: this.include }),
    );
  }

  /** Row-locks the student for the duration of the caller's transaction, serializing every offer mutation (create/approve/accept/reject/revoke) for that student so cap/re-eligibility checks always read consistent state. */
  private lockStudent(tx: TenantTx, studentId: string): Promise<unknown> {
    return tx.$queryRaw`SELECT id FROM students WHERE id = ${studentId} FOR UPDATE`;
  }

  private async existingOffersFor(
    tx: TenantTx,
    studentId: string,
    excludeOfferId: string | null,
  ): Promise<ExistingOffer[]> {
    const offers = await tx.offer.findMany({
      where: {
        studentId,
        id: excludeOfferId ? { not: excludeOfferId } : undefined,
      },
      select: { slab: true, status: true },
    });
    return offers;
  }

  private async assertOfferAllowed(
    tx: TenantTx,
    tenantId: string,
    studentId: string,
    proposedSlab: Slab | null,
    excludeOfferId: string | null,
  ): Promise<void> {
    const [capPolicy, reEligibilityPolicy, existingOffers] = await Promise.all([
      this.slabService.resolveOfferCapPolicy(tenantId, tx),
      this.slabService.resolveReEligibilityPolicy(tenantId, tx),
      this.existingOffersFor(tx, studentId, excludeOfferId),
    ]);

    const result = checkOfferEligibility({
      proposedSlab,
      existingOffers,
      capPolicy,
      reEligibilityPolicy,
    });
    if (!result.allowed) {
      throw new ConflictException(result.reason);
    }
  }

  /**
   * Extends a new offer. RECRUITER (PROPOSE scope) offers land as PENDING —
   * they need TPO/Super Admin approval before they count against the offer
   * cap. TPO/Super Admin (FULL scope) offers are extended immediately, so
   * the cap/re-eligibility gate only runs for the immediate-EXTENDED path;
   * approve() runs it again for the PENDING->EXTENDED transition.
   */
  async create(
    tenantId: string,
    actorScope: PermissionScope,
    actorCompanyId: string | undefined,
    dto: CreateOfferDto,
  ): Promise<Offer> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: dto.applicationId },
        include: { drive: { include: { jobDescription: true } } },
      });
      if (!application) {
        throw new NotFoundException("Application not found");
      }

      const jd = application.drive.jobDescription;
      if (
        actorScope === PermissionScope.PROPOSE &&
        jd.companyId !== actorCompanyId
      ) {
        throw new ForbiddenException(
          "Recruiters can only extend offers for their own company's job descriptions",
        );
      }

      const slab = await this.slabService.classifyForTenant(
        tenantId,
        dto.ctcLpa,
        tx,
      );
      const status: OfferStatus =
        actorScope === PermissionScope.PROPOSE ? "PENDING" : "EXTENDED";

      if (status === "EXTENDED") {
        await this.lockStudent(tx, application.studentId);
        await this.assertOfferAllowed(
          tx,
          tenantId,
          application.studentId,
          slab,
          null,
        );
      }

      const offer = await tx.offer.create({
        data: {
          tenantId,
          studentId: application.studentId,
          applicationId: application.id,
          ctcLpa: dto.ctcLpa,
          slab,
          status,
        },
      });

      if (status === "EXTENDED") {
        this.events.emit("offer.extended", {
          tenantId,
          offerId: offer.id,
          studentId: offer.studentId,
        });
      }

      return offer;
    });
  }

  /**
   * PPOs convert an internship directly into an offer with no Application
   * (SP-19) — `sourceInternshipId` is an opaque reference, not a modeled
   * entity, so there's no ownership chain a RECRUITER could be checked
   * against the way create() checks JD.companyId. Restricted to TPO/Super
   * Admin (FULL scope) rather than trusting a recruiter's self-reported
   * claim that a given student was their intern. Extended immediately, like
   * every other FULL-scope offer — no PENDING step.
   */
  async createPpo(tenantId: string, dto: CreatePpoOfferDto): Promise<Offer> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: dto.studentId },
      });
      if (!student) {
        throw new NotFoundException("Student not found");
      }

      const slab = await this.slabService.classifyForTenant(
        tenantId,
        dto.ctcLpa,
        tx,
      );

      await this.lockStudent(tx, dto.studentId);
      await this.assertOfferAllowed(tx, tenantId, dto.studentId, slab, null);

      const offer = await tx.offer.create({
        data: {
          tenantId,
          studentId: dto.studentId,
          applicationId: null,
          ctcLpa: dto.ctcLpa,
          slab,
          status: "EXTENDED",
          isPpo: true,
          sourceInternshipId: dto.sourceInternshipId,
        },
      });

      this.events.emit("offer.extended", {
        tenantId,
        offerId: offer.id,
        studentId: offer.studentId,
        isPpo: true,
      });

      return offer;
    });
  }

  /** TPO/Super Admin promotes a recruiter's PENDING proposal to EXTENDED — this is where the cap/re-eligibility gate actually runs for the propose path. */
  async approve(tenantId: string, offerId: string): Promise<Offer> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer) throw new NotFoundException("Offer not found");
      if (offer.status !== "PENDING") {
        throw new ConflictException(
          `Cannot approve an offer in "${offer.status}" status`,
        );
      }

      await this.lockStudent(tx, offer.studentId);
      await this.assertOfferAllowed(
        tx,
        tenantId,
        offer.studentId,
        offer.slab,
        offer.id,
      );

      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { status: "EXTENDED" },
      });
      this.events.emit("offer.extended", {
        tenantId,
        offerId: updated.id,
        studentId: updated.studentId,
      });
      return updated;
    });
  }

  /**
   * Row-locked, transactional accept — the concurrency-critical path.
   * Locking the student row serializes concurrent accept attempts for the
   * same student (e.g. two EXTENDED offers in the same slab tier, or an
   * accept racing an approve/revoke), so exactly one wins the cap check
   * and the rest see the now-committed state and fail closed.
   */
  async accept(
    tenantId: string,
    offerId: string,
    studentUserId: string,
  ): Promise<Offer> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const offer = await tx.offer.findUnique({
        where: { id: offerId },
        include: { student: true },
      });
      if (!offer) throw new NotFoundException("Offer not found");
      if (offer.student.userId !== studentUserId) {
        throw new ForbiddenException("Not authorized for this offer");
      }
      if (offer.status !== "EXTENDED") {
        throw new ConflictException(
          `Cannot accept an offer in "${offer.status}" status`,
        );
      }

      await this.lockStudent(tx, offer.studentId);
      await this.assertOfferAllowed(
        tx,
        tenantId,
        offer.studentId,
        offer.slab,
        offer.id,
      );

      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      await tx.student.update({
        where: { id: offer.studentId },
        data: { placementStatus: "PLACED" },
      });
      this.events.emit("offer.accepted", {
        tenantId,
        offerId: updated.id,
        studentId: updated.studentId,
      });
      return updated;
    });
  }

  /** Rejecting an offer may trigger the institution's DEBAR_RULE policy (auto-debar after N rejections). */
  async reject(
    tenantId: string,
    offerId: string,
    studentUserId: string,
  ): Promise<Offer> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const offer = await tx.offer.findUnique({
        where: { id: offerId },
        include: { student: true },
      });
      if (!offer) throw new NotFoundException("Offer not found");
      if (offer.student.userId !== studentUserId) {
        throw new ForbiddenException("Not authorized for this offer");
      }
      if (offer.status !== "EXTENDED") {
        throw new ConflictException(
          `Cannot reject an offer in "${offer.status}" status`,
        );
      }

      await this.lockStudent(tx, offer.studentId);

      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { status: "REJECTED", respondedAt: new Date() },
      });

      const rule = await tx.policyRule.findFirst({
        where: {
          type: "DEBAR_RULE",
          name: DEBAR_RULE_NAME,
          status: "ACTIVE",
        },
      });
      const parsed = rule
        ? DebarRuleDefinitionSchema.safeParse(rule.definition)
        : null;
      const debarPolicy = parsed?.success ? parsed.data : null;

      if (debarPolicy?.debarOnOfferRejection) {
        const rejectionCount = await tx.offer.count({
          where: { studentId: offer.studentId, status: "REJECTED" },
        });
        const threshold = debarPolicy.maxRejectionsBeforeDebar ?? 1;
        if (rejectionCount >= threshold) {
          await tx.student.update({
            where: { id: offer.studentId },
            data: { placementStatus: "DEBARRED" },
          });
          await tx.auditEvent.create({
            data: {
              tenantId,
              action: "student.debarred",
              resourceType: "Student",
              resourceId: offer.studentId,
              metadata: {
                reason: "auto-debar-on-offer-rejection",
                rejectionCount,
                threshold,
                triggeringOfferId: offer.id,
              },
            },
          });
        }
      }

      this.events.emit("offer.rejected", {
        tenantId,
        offerId: updated.id,
        studentId: updated.studentId,
      });
      return updated;
    });
  }

  /** TPO/Super Admin only. Revoking an ACCEPTED offer that was the student's only accepted offer reverts them to UNPLACED. */
  async revoke(
    tenantId: string,
    offerId: string,
    actorUserId: string,
  ): Promise<Offer> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer) throw new NotFoundException("Offer not found");
      if (offer.status === "REVOKED") {
        throw new ConflictException("Offer is already revoked");
      }

      await this.lockStudent(tx, offer.studentId);

      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { status: "REVOKED" },
      });

      if (offer.status === "ACCEPTED") {
        const remainingAccepted = await tx.offer.count({
          where: { studentId: offer.studentId, status: "ACCEPTED" },
        });
        if (remainingAccepted === 0) {
          await tx.student.update({
            where: { id: offer.studentId },
            data: { placementStatus: "UNPLACED" },
          });
        }
      }

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorUserId,
          action: "offer.revoked",
          resourceType: "Offer",
          resourceId: offer.id,
          metadata: { previousStatus: offer.status },
        },
      });

      this.events.emit("offer.revoked", {
        tenantId,
        offerId: updated.id,
        studentId: updated.studentId,
      });
      return updated;
    });
  }
}
