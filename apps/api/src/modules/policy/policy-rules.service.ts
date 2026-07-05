import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PolicyRule, PolicyRuleStatus, PolicyRuleType, Prisma } from "@pms/db";
import { validatePolicyRuleDefinition } from "@pms/types";
import { TenantPrismaService } from "../../database/tenant-prisma.service";

/**
 * PolicyRule is versioned by convention, not by mutation: creating a new
 * version always inserts a new row (supersedesId pointing at the old one)
 * rather than editing definition in place, so an EligibilityEvaluation
 * that recorded ruleVersion=<id> always has an immutable rule to point
 * back to (SP-16 depends on this for determinism).
 */
@Injectable()
export class PolicyRulesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private validateOrThrow(
    type: PolicyRuleType,
    definition: unknown,
  ): Record<string, unknown> {
    const result = validatePolicyRuleDefinition(type, definition);
    if (!result.success) {
      throw new BadRequestException({
        message: `Invalid definition for rule type ${type}`,
        issues: result.error.issues,
      });
    }
    return result.data as Record<string, unknown>;
  }

  findMany(
    tenantId: string,
    filters: { type?: PolicyRuleType; status?: PolicyRuleStatus } = {},
  ): Promise<PolicyRule[]> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.policyRule.findMany({
        where: { type: filters.type, status: filters.status },
        orderBy: [{ name: "asc" }, { version: "desc" }],
      }),
    );
  }

  findOne(tenantId: string, id: string): Promise<PolicyRule | null> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.policyRule.findUnique({ where: { id } }),
    );
  }

  create(
    tenantId: string,
    dto: {
      type: PolicyRuleType;
      name: string;
      definition: Record<string, unknown>;
    },
  ): Promise<PolicyRule> {
    const definition = this.validateOrThrow(dto.type, dto.definition);
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.policyRule.create({
        data: {
          tenantId,
          type: dto.type,
          name: dto.name,
          definition: definition as Prisma.InputJsonValue,
          version: 1,
          status: "DRAFT",
        },
      }),
    );
  }

  async createVersion(
    tenantId: string,
    supersedesId: string,
    definition: Record<string, unknown>,
  ): Promise<PolicyRule> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const previous = await tx.policyRule.findUnique({
        where: { id: supersedesId },
      });
      if (!previous) throw new NotFoundException("Policy rule not found");

      const validated = this.validateOrThrow(previous.type, definition);
      return tx.policyRule.create({
        data: {
          tenantId,
          type: previous.type,
          name: previous.name,
          definition: validated as Prisma.InputJsonValue,
          version: previous.version + 1,
          status: "DRAFT",
          supersedesId: previous.id,
        },
      });
    });
  }

  /**
   * DRAFT -> ACTIVE, atomically archiving whichever rule is currently
   * ACTIVE in the same family (tenantId + type + name) so there is never
   * more than one active ruleset a given evaluator could ambiguously pick
   * between.
   */
  async activate(tenantId: string, id: string): Promise<PolicyRule> {
    return this.tenantPrisma.run(
      tenantId,
      async (tx: Prisma.TransactionClient) => {
        const rule = await tx.policyRule.findUnique({ where: { id } });
        if (!rule) throw new NotFoundException("Policy rule not found");
        if (rule.status !== "DRAFT") {
          throw new BadRequestException(
            `Only a DRAFT rule can be activated (this rule is ${rule.status})`,
          );
        }

        await tx.policyRule.updateMany({
          where: {
            tenantId,
            type: rule.type,
            name: rule.name,
            status: "ACTIVE",
          },
          data: { status: "ARCHIVED" },
        });

        return tx.policyRule.update({
          where: { id },
          data: { status: "ACTIVE", effectiveFrom: new Date() },
        });
      },
    );
  }

  findActive(
    tenantId: string,
    type: PolicyRuleType,
    name: string,
  ): Promise<PolicyRule | null> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.policyRule.findFirst({ where: { type, name, status: "ACTIVE" } }),
    );
  }
}
