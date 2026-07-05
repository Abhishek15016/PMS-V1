import { Module } from "@nestjs/common";
import { EligibilityModule } from "../eligibility/eligibility.module";
import { StudentsModule } from "../students/students.module";
import { ApplicationsController } from "./applications.controller";
import { ApplicationsService } from "./applications.service";

@Module({
  imports: [StudentsModule, EligibilityModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
