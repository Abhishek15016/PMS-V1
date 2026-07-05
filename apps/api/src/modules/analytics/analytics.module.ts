import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsQueryService } from "./analytics-query.service";
import { RecruiterAnalyticsService } from "./recruiter-analytics.service";
import {
  RecomputeQueueService,
  SUMMARY_RECOMPUTE_QUEUE,
} from "./summary-recompute.queue";
import { SummaryRecomputeListener } from "./summary-recompute.listener";
import { SummaryRecomputeProcessor } from "./summary-recompute.processor";
import { SummaryRecomputeService } from "./summary-recompute.service";

@Module({
  imports: [BullModule.registerQueue({ name: SUMMARY_RECOMPUTE_QUEUE })],
  controllers: [AnalyticsController],
  providers: [
    RecomputeQueueService,
    SummaryRecomputeService,
    SummaryRecomputeProcessor,
    SummaryRecomputeListener,
    AnalyticsQueryService,
    RecruiterAnalyticsService,
  ],
  exports: [SummaryRecomputeService],
})
export class AnalyticsModule {}
