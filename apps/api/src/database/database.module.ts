import { Global, Module } from "@nestjs/common";
import {
  ScopedPrismaRunner,
  TenantPrismaService,
} from "./tenant-prisma.service";

@Global()
@Module({
  providers: [TenantPrismaService, ScopedPrismaRunner],
  exports: [TenantPrismaService, ScopedPrismaRunner],
})
export class DatabaseModule {}
