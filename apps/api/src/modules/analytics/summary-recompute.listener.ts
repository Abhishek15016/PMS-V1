import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TenantPrismaService } from "../../database/tenant-prisma.service";
import { RecomputeQueueService } from "./summary-recompute.queue";

interface StudentScopedEvent {
  tenantId: string;
  studentId: string;
}

interface DriveScopedEvent {
  tenantId: string;
  driveId: string;
}

/**
 * Bridges domain events from applications/offers/eligibility into debounced
 * PlacementSummary recomputes — this module only listens, per the
 * architecture decision that analytics never reaches into other modules'
 * write paths. Most events carry a studentId, resolved to a single batchId
 * via one lookup. The batch-eligibility event (evaluateDriveBatch) doesn't
 * carry a studentId at all — it can touch every student in the tenant — so
 * it schedules a recompute for every batch rather than guessing which one.
 */
@Injectable()
export class SummaryRecomputeListener {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly recomputeQueue: RecomputeQueueService,
  ) {}

  // Stacked, not a single `@OnEvent([...])`: eventemitter2 treats an array
  // argument as namespace segments of ONE dotted event (its wildcard
  // syntax), not "any of these event names" — passing a list of unrelated
  // event names there silently subscribes to an event that never fires.
  @OnEvent("application.created")
  @OnEvent("application.withdrawn")
  @OnEvent("application.round-result-recorded")
  @OnEvent("offer.extended")
  @OnEvent("offer.accepted")
  @OnEvent("offer.rejected")
  @OnEvent("offer.revoked")
  async onStudentScopedEvent(event: StudentScopedEvent): Promise<void> {
    const batchId = await this.resolveBatchId(event.tenantId, event.studentId);
    if (!batchId) return;
    await this.recomputeQueue.scheduleRecompute(event.tenantId, batchId);
  }

  @OnEvent("eligibility.recomputed")
  async onEligibilityRecomputed(
    event:
      | (StudentScopedEvent & { jdId: string })
      | (DriveScopedEvent & { jdId: string }),
  ): Promise<void> {
    if ("studentId" in event) {
      const batchId = await this.resolveBatchId(
        event.tenantId,
        event.studentId,
      );
      if (!batchId) return;
      await this.recomputeQueue.scheduleRecompute(event.tenantId, batchId);
      return;
    }
    // Batch evaluation touches every student in the tenant — schedule every batch.
    const batchIds = await this.tenantPrisma.run(event.tenantId, (tx) =>
      tx.academicBatch.findMany({ select: { id: true } }),
    );
    await Promise.all(
      batchIds.map((b) =>
        this.recomputeQueue.scheduleRecompute(event.tenantId, b.id),
      ),
    );
  }

  private async resolveBatchId(
    tenantId: string,
    studentId: string,
  ): Promise<string | null> {
    const student = await this.tenantPrisma.run(tenantId, (tx) =>
      tx.student.findUnique({
        where: { id: studentId },
        select: { batchId: true },
      }),
    );
    return student?.batchId ?? null;
  }
}
