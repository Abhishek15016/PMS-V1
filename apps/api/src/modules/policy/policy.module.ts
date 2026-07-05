import { Module } from "@nestjs/common";
import { PolicyRulesController } from "./policy-rules.controller";
import { PolicyRulesService } from "./policy-rules.service";

@Module({
  controllers: [PolicyRulesController],
  providers: [PolicyRulesService],
  exports: [PolicyRulesService],
})
export class PolicyModule {}
