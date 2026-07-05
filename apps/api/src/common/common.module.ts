import { Global, Module } from "@nestjs/common";
import { TenantContextStore } from "./context/tenant-context.store";

@Global()
@Module({
  providers: [TenantContextStore],
  exports: [TenantContextStore],
})
export class CommonModule {}
