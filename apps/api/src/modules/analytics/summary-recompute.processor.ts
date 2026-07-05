import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  SUMMARY_RECOMPUTE_QUEUE,
  SummaryRecomputeJobData,
} from "./summary-recompute.queue";
import { SummaryRecomputeService } from "./summary-recompute.service";

@Processor(SUMMARY_RECOMPUTE_QUEUE)
export class SummaryRecomputeProcessor extends WorkerHost {
  constructor(
    private readonly summaryRecomputeService: SummaryRecomputeService,
  ) {
    super();
  }

  async process(job: Job<SummaryRecomputeJobData>): Promise<void> {
    await this.summaryRecomputeService.recomputeForBatch(
      job.data.tenantId,
      job.data.batchId,
    );
  }
}
