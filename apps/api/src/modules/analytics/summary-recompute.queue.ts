import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

export const SUMMARY_RECOMPUTE_QUEUE = "summary-recompute";

export interface SummaryRecomputeJobData {
  tenantId: string;
  batchId: string;
}

/** How long a burst of domain events for the same (tenant, batch) collapses into a single queued recompute — see bullmq-dedup.spike.spec.ts for the mechanism this relies on. */
const DEBOUNCE_TTL_MS = 3000;
/** Small delay so events arriving within the same tick/request all land before the job is picked up, not just before it's added. */
const DEBOUNCE_DELAY_MS = 1000;

@Injectable()
export class RecomputeQueueService {
  constructor(
    @InjectQueue(SUMMARY_RECOMPUTE_QUEUE)
    private readonly queue: Queue<SummaryRecomputeJobData>,
  ) {}

  scheduleRecompute(tenantId: string, batchId: string): Promise<unknown> {
    const dedupId = `${tenantId}:${batchId}`;
    return this.queue.add(
      "recompute",
      { tenantId, batchId },
      {
        delay: DEBOUNCE_DELAY_MS,
        deduplication: { id: dedupId, ttl: DEBOUNCE_TTL_MS },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  }
}
