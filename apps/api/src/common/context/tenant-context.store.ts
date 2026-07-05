import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
}

/**
 * Request-scoped tenant context, threaded through async calls without
 * passing tenantId as an explicit parameter everywhere. Populated by
 * TenantContextMiddleware at the start of each request.
 */
@Injectable()
export class TenantContextStore {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(context: TenantContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  get(): TenantContext | undefined {
    return this.storage.getStore();
  }

  getTenantIdOrThrow(): string {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new Error(
        "TenantContextStore.getTenantIdOrThrow() called outside of a request scoped by TenantContextMiddleware",
      );
    }
    return ctx.tenantId;
  }
}
