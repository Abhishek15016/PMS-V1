import { Module } from "@nestjs/common";
import { InstitutionsService } from "../institutions/institutions.service";
import { OperatorPrismaService } from "./operator-prisma.service";
import { OperatorController } from "./operator.controller";
import { OperatorService } from "./operator.service";

@Module({
  controllers: [OperatorController],
  providers: [OperatorService, OperatorPrismaService, InstitutionsService],
})
export class OperatorModule {}
