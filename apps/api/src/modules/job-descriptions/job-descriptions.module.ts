import { Module } from "@nestjs/common";
import { OffersModule } from "../offers/offers.module";
import { JobDescriptionsController } from "./job-descriptions.controller";
import { JobDescriptionsService } from "./job-descriptions.service";

@Module({
  imports: [OffersModule],
  controllers: [JobDescriptionsController],
  providers: [JobDescriptionsService],
  exports: [JobDescriptionsService],
})
export class JobDescriptionsModule {}
