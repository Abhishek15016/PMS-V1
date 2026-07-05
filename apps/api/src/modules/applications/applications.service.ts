import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  Application,
  ApplicationStatus,
  Prisma,
  Role,
  RoundResult,
} from "@pms/db";
import { TenantPrismaService } from "../../database/tenant-prisma.service";
import { EligibilityService } from "../eligibility/eligibility.service";
import { StudentsService } from "../students/students.service";
import { PermissionScope } from "../rbac/permission.types";
import { deriveApplicationStatusFromRoundResult } from "./application-status.util";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { RecordRoundResultDto } from "./dto/record-round-result.dto";

const OPEN_DRIVE_STATUSES = ["SCHEDULED", "ONGOING"] as const;
const TERMINAL_APPLICATION_STATUSES: ApplicationStatus[] = [
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
];

export type ApplicationWithRelations = Prisma.ApplicationGetPayload<{
  include: {
    student: true;
    drive: { include: { jobDescription: true } };
    roundResults: true;
  };
}>;

const APPLICATION_INCLUDE = {
  student: true,
  drive: { include: { jobDescription: true } },
  roundResults: true,
} as const;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly studentsService: StudentsService,
    private readonly eligibilityService: EligibilityService,
    private readonly events: EventEmitter2,
  ) {}

  findMany(
    tenantId: string,
    filters: {
      studentUserId?: string;
      departmentId?: string;
      driveId?: string;
    } = {},
  ): Promise<ApplicationWithRelations[]> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.application.findMany({
        where: {
          driveId: filters.driveId,
          ...(filters.studentUserId
            ? { student: { userId: filters.studentUserId } }
            : {}),
          ...(filters.departmentId
            ? { student: { departmentId: filters.departmentId } }
            : {}),
        },
        include: APPLICATION_INCLUDE,
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  findOne(
    tenantId: string,
    id: string,
  ): Promise<ApplicationWithRelations | null> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.application.findUnique({
        where: { id },
        include: APPLICATION_INCLUDE,
      }),
    );
  }

  /**
   * Applies to a drive on behalf of the resolved student. Eligibility is
   * always re-checked here (never trusted from a prior evaluate() call the
   * client might show stale) via EligibilityService.evaluate() — the same
   * evaluator SP-16 uses everywhere else, so "can this student apply" and
   * "is this student eligible" can never drift apart into two engines.
   * DEBARRED students are rejected and the attempt is audit-logged per the
   * master plan's explicit anti-pattern: blocked at the API, not just hidden
   * in the UI.
   */
  async apply(
    tenantId: string,
    actorRole: Role,
    actorScope: PermissionScope,
    actorUserId: string,
    actorDepartmentId: string | undefined,
    dto: CreateApplicationDto,
  ): Promise<Application> {
    const studentId = await this.resolveStudentId(
      tenantId,
      actorScope,
      actorUserId,
      dto.studentId,
    );

    const { student, drive } = await this.tenantPrisma.run(
      tenantId,
      async (tx) => {
        const student = await tx.student.findUnique({
          where: { id: studentId },
        });
        if (!student) throw new NotFoundException("Student not found");
        const drive = await tx.drive.findUnique({
          where: { id: dto.driveId },
        });
        if (!drive) throw new NotFoundException("Drive not found");
        return { student, drive };
      },
    );

    if (
      actorRole === "FACULTY_COORD" &&
      student.departmentId !== actorDepartmentId
    ) {
      throw new ForbiddenException(
        "Faculty Coordinators can only apply on behalf of students in their own department",
      );
    }

    if (student.placementStatus === "DEBARRED") {
      await this.tenantPrisma.run(tenantId, (tx) =>
        tx.auditEvent.create({
          data: {
            tenantId,
            actorUserId,
            action: "application.blocked.debarred",
            resourceType: "Student",
            resourceId: studentId,
            metadata: { driveId: dto.driveId },
          },
        }),
      );
      throw new ForbiddenException(
        "This student is debarred and cannot apply to drives",
      );
    }

    if (!OPEN_DRIVE_STATUSES.includes(drive.status as never)) {
      throw new ConflictException(
        `Cannot apply to a drive in "${drive.status}" status`,
      );
    }

    const evaluation = await this.eligibilityService.evaluate(
      tenantId,
      studentId,
      drive.jdId,
    );
    if (!evaluation.eligible) {
      throw new ForbiddenException(
        "Student does not meet this drive's eligibility criteria",
      );
    }

    return this.tenantPrisma.run(tenantId, async (tx) => {
      try {
        const application = await tx.application.create({
          data: {
            tenantId,
            studentId,
            driveId: dto.driveId,
            status: "APPLIED",
          },
        });
        this.events.emit("application.created", {
          tenantId,
          applicationId: application.id,
          studentId,
          driveId: dto.driveId,
        });
        return application;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new ConflictException(
            "Student has already applied to this drive",
          );
        }
        throw err;
      }
    });
  }

  private async resolveStudentId(
    tenantId: string,
    actorScope: PermissionScope,
    actorUserId: string,
    dtoStudentId: string | undefined,
  ): Promise<string> {
    if (actorScope === PermissionScope.SELF) {
      const student = await this.studentsService.findByUserId(
        tenantId,
        actorUserId,
      );
      if (!student) throw new NotFoundException("No student profile found");
      return student.id;
    }
    if (!dtoStudentId) {
      throw new ForbiddenException(
        "studentId is required when applying on behalf of a student",
      );
    }
    return dtoStudentId;
  }

  async withdraw(
    tenantId: string,
    applicationId: string,
    actorRole: Role,
    actorScope: PermissionScope,
    actorUserId: string,
    actorDepartmentId: string | undefined,
  ): Promise<Application> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
        include: { student: true },
      });
      if (!application) throw new NotFoundException("Application not found");

      if (
        actorScope === PermissionScope.SELF &&
        application.student.userId !== actorUserId
      ) {
        throw new ForbiddenException("Not authorized for this application");
      }
      if (
        actorRole === "FACULTY_COORD" &&
        application.student.departmentId !== actorDepartmentId
      ) {
        throw new ForbiddenException("Not authorized for this application");
      }

      if (TERMINAL_APPLICATION_STATUSES.includes(application.status)) {
        throw new ConflictException(
          `Cannot withdraw an application in "${application.status}" status`,
        );
      }

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: { status: "WITHDRAWN" },
      });
      this.events.emit("application.withdrawn", {
        tenantId,
        applicationId,
        studentId: application.studentId,
      });
      return updated;
    });
  }

  /** RECRUITER (SELF scope, own company) or TPO/Super Admin (FULL) shortlists an APPLIED application before round-progression begins. */
  async shortlist(
    tenantId: string,
    applicationId: string,
    actorScope: PermissionScope,
    actorCompanyId: string | undefined,
  ): Promise<Application> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
        include: { drive: { include: { jobDescription: true } } },
      });
      if (!application) throw new NotFoundException("Application not found");

      if (
        actorScope === PermissionScope.SELF &&
        application.drive.jobDescription.companyId !== actorCompanyId
      ) {
        throw new ForbiddenException("Not authorized for this application");
      }

      if (application.status !== "APPLIED") {
        throw new ConflictException(
          `Cannot shortlist an application in "${application.status}" status`,
        );
      }

      return tx.application.update({
        where: { id: applicationId },
        data: { status: "SHORTLISTED" },
      });
    });
  }

  /**
   * Recording a round result drives the Application's status machine:
   * FAIL -> REJECTED (terminal); PASS on the pipeline's last round ->
   * SELECTED (terminal); everything else (PASS on a non-final round, or
   * PENDING) -> IN_ROUND. Re-recording a result for the same round is an
   * upsert (unique on applicationId+roundId), so correcting a mistaken
   * entry just recomputes the same way — idempotent by construction.
   */
  async recordRoundResult(
    tenantId: string,
    applicationId: string,
    dto: RecordRoundResultDto,
  ): Promise<RoundResult> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
      });
      if (!application) throw new NotFoundException("Application not found");
      if (application.status === "WITHDRAWN") {
        throw new ConflictException(
          "Cannot record a round result for a withdrawn application",
        );
      }

      const round = await tx.round.findUnique({
        where: { id: dto.roundId },
      });
      if (!round || round.driveId !== application.driveId) {
        throw new NotFoundException(
          "Round not found for this application's drive",
        );
      }

      const result = await tx.roundResult.upsert({
        where: {
          applicationId_roundId: { applicationId, roundId: dto.roundId },
        },
        create: {
          tenantId,
          applicationId,
          roundId: dto.roundId,
          status: dto.status,
          score: dto.score,
          notes: dto.notes,
          recordedAt: new Date(),
        },
        update: {
          status: dto.status,
          score: dto.score,
          notes: dto.notes,
          recordedAt: new Date(),
        },
      });

      const allRounds = await tx.round.findMany({
        where: { driveId: application.driveId },
      });
      const maxPosition = Math.max(...allRounds.map((r) => r.position));
      const nextStatus = deriveApplicationStatusFromRoundResult(
        dto.status,
        round.position,
        maxPosition,
      );

      await tx.application.update({
        where: { id: applicationId },
        data: { status: nextStatus },
      });

      this.events.emit("application.round-result-recorded", {
        tenantId,
        applicationId,
        studentId: application.studentId,
        roundId: dto.roundId,
        resultStatus: dto.status,
        applicationStatus: nextStatus,
      });

      return result;
    });
  }
}
