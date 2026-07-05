import { Injectable } from "@nestjs/common";
import { Slab } from "@pms/db";
import {
  OfferCapDefinition,
  OfferCapDefinitionSchema,
  ReEligibilityDefinition,
  ReEligibilityDefinitionSchema,
  SlabDefinition,
  SlabDefinitionSchema,
} from "@pms/types";
import {
  TenantPrismaService,
  TenantTx,
} from "../../database/tenant-prisma.service";

/** Well-known PolicyRule names, same convention as EligibilityService's institution-default rule (slice 11). */
export const SLAB_DEFINITION_RULE_NAME = "institution-default-slab-definition";
export const OFFER_CAP_RULE_NAME = "institution-default-offer-cap";
export const RE_ELIGIBILITY_RULE_NAME = "institution-default-re-eligibility";

@Injectable()
export class SlabService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** ctc >= dreamMinCtc -> DREAM; ctc >= superDreamMinCtc -> SUPER_DREAM; else NON_DREAM. Null definition means "no policy configured yet" — cannot classify. */
  classifySlab(ctcLpa: number, definition: SlabDefinition | null): Slab | null {
    if (!definition) return null;
    if (ctcLpa >= definition.dreamMinCtc) return "DREAM";
    if (ctcLpa >= definition.superDreamMinCtc) return "SUPER_DREAM";
    return "NON_DREAM";
  }

  /**
   * `tx` lets a caller that's already inside its own tenant transaction
   * (e.g. OffersService holding a row lock) reuse that transaction instead
   * of opening a nested one via `tenantPrisma.run` — nesting would run the
   * policy lookup on a different pooled connection, outside the caller's
   * lock. Callers with no transaction of their own (e.g. JD creation) omit
   * `tx` and get one opened for them.
   */
  async resolveSlabDefinition(
    tenantId: string,
    tx?: TenantTx,
  ): Promise<SlabDefinition | null> {
    const query = async (client: TenantTx) => {
      const rule = await client.policyRule.findFirst({
        where: {
          type: "SLAB_DEFINITION",
          name: SLAB_DEFINITION_RULE_NAME,
          status: "ACTIVE",
        },
      });
      if (!rule) return null;
      const parsed = SlabDefinitionSchema.safeParse(rule.definition);
      return parsed.success ? parsed.data : null;
    };
    return tx ? query(tx) : this.tenantPrisma.run(tenantId, query);
  }

  async resolveOfferCapPolicy(
    tenantId: string,
    tx?: TenantTx,
  ): Promise<OfferCapDefinition | null> {
    const query = async (client: TenantTx) => {
      const rule = await client.policyRule.findFirst({
        where: {
          type: "OFFER_CAP",
          name: OFFER_CAP_RULE_NAME,
          status: "ACTIVE",
        },
      });
      if (!rule) return null;
      const parsed = OfferCapDefinitionSchema.safeParse(rule.definition);
      return parsed.success ? parsed.data : null;
    };
    return tx ? query(tx) : this.tenantPrisma.run(tenantId, query);
  }

  async resolveReEligibilityPolicy(
    tenantId: string,
    tx?: TenantTx,
  ): Promise<ReEligibilityDefinition | null> {
    const query = async (client: TenantTx) => {
      const rule = await client.policyRule.findFirst({
        where: {
          type: "RE_ELIGIBILITY",
          name: RE_ELIGIBILITY_RULE_NAME,
          status: "ACTIVE",
        },
      });
      if (!rule) return null;
      const parsed = ReEligibilityDefinitionSchema.safeParse(rule.definition);
      return parsed.success ? parsed.data : null;
    };
    return tx ? query(tx) : this.tenantPrisma.run(tenantId, query);
  }

  async classifyForTenant(
    tenantId: string,
    ctcLpa: number,
    tx?: TenantTx,
  ): Promise<Slab | null> {
    const definition = await this.resolveSlabDefinition(tenantId, tx);
    return this.classifySlab(ctcLpa, definition);
  }
}
