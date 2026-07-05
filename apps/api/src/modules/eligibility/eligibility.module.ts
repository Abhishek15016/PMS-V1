import { Module } from "@nestjs/common";
import { EligibilityController } from "./eligibility.controller";
import { EligibilityService } from "./eligibility.service";

@Module({
  controllers: [EligibilityController],
  providers: [EligibilityService],
  exports: [EligibilityService],
})
export class EligibilityModule {}
