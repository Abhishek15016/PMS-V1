import { Module } from "@nestjs/common";
import { EligibilityModule } from "../eligibility/eligibility.module";
import { DrivesController } from "./drives.controller";
import { DrivesService } from "./drives.service";

@Module({
  imports: [EligibilityModule],
  controllers: [DrivesController],
  providers: [DrivesService],
  exports: [DrivesService],
})
export class DrivesModule {}
