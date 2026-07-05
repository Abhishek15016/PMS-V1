import { Module } from "@nestjs/common";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";
import { SlabService } from "./slab.service";

@Module({
  controllers: [OffersController],
  providers: [SlabService, OffersService],
  exports: [SlabService, OffersService],
})
export class OffersModule {}
