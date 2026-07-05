import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, Student } from "@pms/db";
import {
  EligibilityCriteriaDefinition,
  EligibilityCriteriaDefinitionSchema,
} from "@pms/types";
import { TenantPrismaService } from "../../database/tenant-prisma.service";
import {
  EligibilityEvaluatorInput,
  EligibilityReason,
  EligibilityResult,
  EvaluatorStudentInput,
} from "./eligibility.types";
import { runEligibilityEvaluators } from "./rule-evaluators";

/**
 * Well-known name PolicyRulesService.activate() family lookups key on for
 * the institution-wide default eligibility criteria (see slice 9's
 * versioning: activating a rule in this (type, name) family archives
 * whichever version was previously active). TPOs are expected to create
 * their main eligibility policy under this name; if none exists, drives
 * are evaluated against JD-level minCriteria alone.
 */
export const INSTITUTION_DEFAULT_ELIGIBILITY_RULE_NAME =
  "institution-default-eligibility-criteria";

export interface DriveEligibilitySummary {
  totalEvaluated: number;
  eligibleCount: number;
  ineligibleCount: number;
  fromCache: number;
  freshlyEvaluated: number;
}

export interface StudentEligibility {
  student: {
    id: string;
    email: string;
    displayName: string;
    departmentCode: string;
  };
  reasons: EligibilityReason[];
}

export interface DriveEligibilityResult {
  eligible: StudentEligibility["student"][];
  ineligible: StudentEligibility[];
  summary: DriveEligibilitySummary;
}

type StudentWithDept = Student & {
  department: { code: string };
  user: { email: string; displayName: string };
};

export interface DryRunDiffEntry {
  id: string;
  email: string;
  displayName: string;
  departmentCode: string;
}

export interface DryRunResult {
  current: { eligibleCount: number; ineligibleCount: number };
  proposed: { eligibleCount: number; ineligibleCount: number };
  newlyEligible: DryRunDiffEntry[];
  newlyIneligible: DryRunDiffEntry[];
}

@Injectable()
export class EligibilityService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Same leniency rationale as the JD.minCriteria parse below — a malformed institution rule degrades to "no institution-wide restriction" rather than breaking every evaluation in the tenant. */
  private parseCriteria(raw: unknown): EligibilityCriteriaDefinition {
    const result = EligibilityCriteriaDefinitionSchema.safeParse(raw);
    return result.success ? result.data : {};
  }

  private toEvaluatorStudent(student: StudentWithDept): EvaluatorStudentInput {
    return {
      cgpa: student.cgpa ? Number(student.cgpa) : null,
      tenthPercent: student.tenthPercent ? Number(student.tenthPercent) : null,
      twelfthPercent: student.twelfthPercent
        ? Number(student.twelfthPercent)
        : null,
      activeBacklogs: student.activeBacklogs,
      backlogHistory: student.backlogHistory,
      gapYears: student.gapYears,
      diplomaFlag: student.diplomaFlag,
      category: student.category,
      placementStatus: student.placementStatus,
      departmentCode: student.department.code,
    };
  }

  /**
   * Institution-wide defaults, overridden per-field by the JD's own
   * minCriteria snapshot. Returns the PolicyRule id (or null if no
   * institution rule is active) — that id is exactly what's cached as
   * EligibilityEvaluation.ruleVersion, so activating a new institution
   * policy version automatically makes prior cache rows stale-by-key
   * (they simply don't match the new ruleVersion) without any explicit
   * invalidation step.
   */
  private async resolveCriteria(
    tx: Prisma.TransactionClient,
    jdMinCriteria: unknown,
  ): Promise<{
    criteria: EligibilityCriteriaDefinition;
    ruleVersion: string | null;
  }> {
    const institutionRule = await tx.policyRule.findFirst({
      where: {
        type: "ELIGIBILITY_CRITERIA",
        name: INSTITUTION_DEFAULT_ELIGIBILITY_RULE_NAME,
        status: "ACTIVE",
      },
    });

    const institutionCriteria = institutionRule
      ? this.parseCriteria(institutionRule.definition)
      : {};
    const jdCriteria = this.parseCriteria(jdMinCriteria);

    return {
      criteria: { ...institutionCriteria, ...jdCriteria },
      ruleVersion: institutionRule?.id ?? null,
    };
  }

  /**
   * Always recomputes fresh (and then upserts the cache), unlike
   * evaluateDriveBatch which serves a cache hit without recomputing. This
   * is deliberate: a single-student lookup is what a TPO reaches for when
   * they want an up-to-the-moment answer for one person, while the batch
   * list view is the one with the <200ms-on-repeat perf target that
   * actually needs the skip-if-cached fast path.
   */
  async evaluate(
    tenantId: string,
    studentId: string,
    jdId: string,
  ): Promise<EligibilityResult> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const [student, jd] = await Promise.all([
        tx.student.findUnique({
          where: { id: studentId },
          include: { department: true, user: true },
        }),
        tx.jobDescription.findUnique({ where: { id: jdId } }),
      ]);
      if (!student) throw new NotFoundException("Student not found");
      if (!jd) throw new NotFoundException("Job description not found");

      const { criteria, ruleVersion } = await this.resolveCriteria(
        tx,
        jd.minCriteria,
      );
      const input: EligibilityEvaluatorInput = {
        student: this.toEvaluatorStudent(student),
        criteria,
        eligiblePrograms: jd.eligiblePrograms,
      };
      const result = runEligibilityEvaluators(input);

      await this.upsertCache(
        tx,
        tenantId,
        studentId,
        jdId,
        ruleVersion,
        result,
      );
      this.events.emit("eligibility.recomputed", {
        tenantId,
        studentId,
        jdId,
        ruleVersion,
      });

      return result;
    });
  }

  private async upsertCache(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    jdId: string,
    ruleVersion: string | null,
    result: EligibilityResult,
  ): Promise<void> {
    const existing = await tx.eligibilityEvaluation.findFirst({
      where: { studentId, jdId, ruleVersion },
    });
    const data = {
      result: result.eligible,
      reasons: result.reasons as unknown as Prisma.InputJsonValue,
      evaluatedAt: new Date(),
    };
    if (existing) {
      await tx.eligibilityEvaluation.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await tx.eligibilityEvaluation.create({
        data: { tenantId, studentId, jdId, ruleVersion, ...data },
      });
    }
  }

  /**
   * Batch-evaluates every student in the tenant against a drive's JD.
   * Students whose (studentId, jdId, ruleVersion) is already cached are
   * served straight from the cache with zero re-evaluation — this is what
   * makes a repeat call on an unchanged rule version fast (SP-16's <200ms
   * cached-rerun target), since nothing except one SELECT runs.
   */
  async evaluateDriveBatch(
    tenantId: string,
    driveId: string,
  ): Promise<DriveEligibilityResult> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const drive = await tx.drive.findUnique({ where: { id: driveId } });
      if (!drive) throw new NotFoundException("Drive not found");
      const jd = await tx.jobDescription.findUnique({
        where: { id: drive.jdId },
      });
      if (!jd) throw new NotFoundException("Job description not found");

      const { criteria, ruleVersion } = await this.resolveCriteria(
        tx,
        jd.minCriteria,
      );
      const students = (await tx.student.findMany({
        include: { department: true, user: true },
        orderBy: { createdAt: "asc" },
      })) as StudentWithDept[];

      const cached = await tx.eligibilityEvaluation.findMany({
        where: {
          jdId: jd.id,
          ruleVersion,
          studentId: { in: students.map((s) => s.id) },
        },
      });
      const cacheByStudent = new Map(cached.map((row) => [row.studentId, row]));

      const eligible: StudentEligibility["student"][] = [];
      const ineligible: StudentEligibility[] = [];
      const toCreate: Prisma.EligibilityEvaluationCreateManyInput[] = [];
      let fromCache = 0;

      for (const student of students) {
        const publicStudent = {
          id: student.id,
          email: student.user.email,
          displayName: student.user.displayName,
          departmentCode: student.department.code,
        };

        const cachedRow = cacheByStudent.get(student.id);
        let result: EligibilityResult;
        if (cachedRow) {
          fromCache += 1;
          result = {
            eligible: cachedRow.result,
            reasons: cachedRow.reasons as unknown as EligibilityReason[],
          };
        } else {
          result = runEligibilityEvaluators({
            student: this.toEvaluatorStudent(student),
            criteria,
            eligiblePrograms: jd.eligiblePrograms,
          });
          toCreate.push({
            tenantId,
            studentId: student.id,
            jdId: jd.id,
            ruleVersion,
            result: result.eligible,
            reasons: result.reasons as unknown as Prisma.InputJsonValue,
          });
        }

        if (result.eligible) {
          eligible.push(publicStudent);
        } else {
          ineligible.push({ student: publicStudent, reasons: result.reasons });
        }
      }

      if (toCreate.length > 0) {
        await tx.eligibilityEvaluation.createMany({ data: toCreate });
      }

      this.events.emit("eligibility.recomputed", {
        tenantId,
        driveId,
        jdId: jd.id,
        ruleVersion,
        evaluatedCount: students.length,
      });

      return {
        eligible,
        ineligible,
        summary: {
          totalEvaluated: students.length,
          eligibleCount: eligible.length,
          ineligibleCount: ineligible.length,
          fromCache,
          freshlyEvaluated: toCreate.length,
        },
      };
    });
  }

  /**
   * Simulates replacing the institution-wide default criteria with
   * `proposedInstitutionCriteria` (the JD's own minCriteria still applies
   * on top, unchanged, exactly as it does for a real evaluation) and
   * reports cohort counts + which specific students would flip either
   * direction, against a single JD. Never calls create/update/createMany —
   * proven side-effect-free by never touching the cache table at all, not
   * merely by not committing a transaction.
   */
  async dryRun(
    tenantId: string,
    jdId: string,
    proposedInstitutionCriteria: unknown,
  ): Promise<DryRunResult> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const jd = await tx.jobDescription.findUnique({ where: { id: jdId } });
      if (!jd) throw new NotFoundException("Job description not found");

      const { criteria: currentCriteria } = await this.resolveCriteria(
        tx,
        jd.minCriteria,
      );
      const jdCriteria = this.parseCriteria(jd.minCriteria);
      const proposedCriteria = {
        ...this.parseCriteria(proposedInstitutionCriteria),
        ...jdCriteria,
      };

      const students = (await tx.student.findMany({
        include: { department: true, user: true },
        orderBy: { createdAt: "asc" },
      })) as StudentWithDept[];

      let currentEligibleCount = 0;
      let proposedEligibleCount = 0;
      const newlyEligible: DryRunDiffEntry[] = [];
      const newlyIneligible: DryRunDiffEntry[] = [];

      for (const student of students) {
        const evaluatorStudent = this.toEvaluatorStudent(student);
        const current = runEligibilityEvaluators({
          student: evaluatorStudent,
          criteria: currentCriteria,
          eligiblePrograms: jd.eligiblePrograms,
        });
        const proposed = runEligibilityEvaluators({
          student: evaluatorStudent,
          criteria: proposedCriteria,
          eligiblePrograms: jd.eligiblePrograms,
        });

        if (current.eligible) currentEligibleCount += 1;
        if (proposed.eligible) proposedEligibleCount += 1;

        if (current.eligible !== proposed.eligible) {
          const entry: DryRunDiffEntry = {
            id: student.id,
            email: student.user.email,
            displayName: student.user.displayName,
            departmentCode: student.department.code,
          };
          if (proposed.eligible) {
            newlyEligible.push(entry);
          } else {
            newlyIneligible.push(entry);
          }
        }
      }

      return {
        current: {
          eligibleCount: currentEligibleCount,
          ineligibleCount: students.length - currentEligibleCount,
        },
        proposed: {
          eligibleCount: proposedEligibleCount,
          ineligibleCount: students.length - proposedEligibleCount,
        },
        newlyEligible,
        newlyIneligible,
      };
    });
  }
}
