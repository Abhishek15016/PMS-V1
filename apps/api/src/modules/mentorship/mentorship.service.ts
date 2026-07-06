import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Student } from "@pms/db";
import type {
  CreateReplyInput,
  CreateThreadInput,
  MentorCard,
  MentorReply,
  MentorThread,
} from "@pms/types";
import { TenantPrismaService } from "../../database/tenant-prisma.service";

const THREAD_INCLUDE = {
  author: { include: { user: true } },
  mentor: { include: { user: true } },
  replies: {
    include: { author: { include: { studentProfile: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

type ThreadRow = Prisma.MentorThreadGetPayload<{
  include: {
    author: { include: { user: true } };
    mentor: { include: { user: true } };
    replies: { include: { author: { include: { studentProfile: true } } } };
  };
}>;

@Injectable()
export class MentorshipService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** Placed + opted-in students, joined with the offer that placed them —
   * ranked by how many replies they've contributed. */
  async listMentors(tenantId: string): Promise<MentorCard[]> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const mentors = await tx.student.findMany({
        where: { mentorOptIn: true, placementStatus: "PLACED", deletedAt: null },
        include: {
          user: true,
          department: true,
          batch: true,
          offers: {
            where: { status: "ACCEPTED" },
            orderBy: { ctcLpa: "desc" },
            take: 1,
            include: {
              application: {
                include: {
                  drive: {
                    include: {
                      jobDescription: { include: { company: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      const replyCounts = await tx.mentorReply.groupBy({
        by: ["authorUserId"],
        _count: { id: true },
      });
      const countByUser = new Map(
        replyCounts.map((r) => [r.authorUserId, r._count.id]),
      );
      return mentors
        .map((m): MentorCard => {
          const offer = m.offers[0];
          const company =
            offer?.application?.drive.jobDescription.company ?? null;
          return {
            studentId: m.id,
            displayName: m.user.displayName,
            departmentCode: m.department.code,
            batchLabel: m.batch.label,
            headline: m.mentorHeadline,
            companyName: company?.name ?? null,
            companyWebsite: company?.website ?? null,
            ctcLpa: offer ? Number(offer.ctcLpa) : null,
            slab: offer?.slab ?? null,
            isPpo: offer?.isPpo ?? false,
            answeredCount: countByUser.get(m.userId) ?? 0,
          };
        })
        .sort((a, b) => b.answeredCount - a.answeredCount || (b.ctcLpa ?? 0) - (a.ctcLpa ?? 0));
    });
  }

  /** Opt in/out as a mentor — only the placed student themself. */
  async updateMentorProfile(
    tenantId: string,
    userId: string,
    input: { mentorOptIn: boolean; mentorHeadline?: string | null },
  ): Promise<Student> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const student = await tx.student.findUnique({ where: { userId } });
      if (!student) throw new NotFoundException("No student profile");
      if (input.mentorOptIn && student.placementStatus !== "PLACED") {
        throw new ForbiddenException(
          "Only placed students can opt in as mentors",
        );
      }
      return tx.student.update({
        where: { id: student.id },
        data: {
          mentorOptIn: input.mentorOptIn,
          mentorHeadline: input.mentorHeadline ?? student.mentorHeadline,
        },
      });
    });
  }

  async listThreads(tenantId: string): Promise<MentorThread[]> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const rows = await tx.mentorThread.findMany({
        include: THREAD_INCLUDE,
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
      return rows.map((row) => this.toThreadDto(row, false));
    });
  }

  async getThread(tenantId: string, id: string): Promise<MentorThread> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const row = await tx.mentorThread.findUnique({
        where: { id },
        include: THREAD_INCLUDE,
      });
      if (!row) throw new NotFoundException();
      return this.toThreadDto(row, true);
    });
  }

  async createThread(
    tenantId: string,
    userId: string,
    input: CreateThreadInput,
  ): Promise<MentorThread> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const student = await tx.student.findUnique({ where: { userId } });
      if (!student) {
        throw new ForbiddenException("Only students can start a thread");
      }
      if (input.mentorStudentId) {
        const mentor = await tx.student.findUnique({
          where: { id: input.mentorStudentId },
        });
        if (!mentor?.mentorOptIn) {
          throw new NotFoundException("That mentor isn't accepting questions");
        }
      }
      const created = await tx.mentorThread.create({
        data: {
          tenantId,
          authorStudentId: student.id,
          mentorStudentId: input.mentorStudentId ?? null,
          title: input.title,
          body: input.body,
        },
        include: THREAD_INCLUDE,
      });
      return this.toThreadDto(created, true);
    });
  }

  async addReply(
    tenantId: string,
    userId: string,
    threadId: string,
    input: CreateReplyInput,
  ): Promise<MentorThread> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const thread = await tx.mentorThread.findUnique({
        where: { id: threadId },
      });
      if (!thread) throw new NotFoundException();
      await tx.mentorReply.create({
        data: { tenantId, threadId, authorUserId: userId, body: input.body },
      });
      // A mentor/staff reply moves the thread out of OPEN automatically.
      const author = await tx.user.findUnique({
        where: { id: userId },
        include: { studentProfile: true },
      });
      const isAnswerer =
        author?.role !== "STUDENT" ||
        author.studentProfile?.placementStatus === "PLACED";
      const updated = await tx.mentorThread.update({
        where: { id: threadId },
        data: isAnswerer ? { status: "ANSWERED" } : { updatedAt: new Date() },
        include: THREAD_INCLUDE,
      });
      return this.toThreadDto(updated, true);
    });
  }

  private toThreadDto(row: ThreadRow, withReplies: boolean): MentorThread {
    return {
      id: row.id,
      authorStudentId: row.authorStudentId,
      authorName: row.author.user.displayName,
      mentorStudentId: row.mentorStudentId,
      mentorName: row.mentor?.user.displayName ?? null,
      title: row.title,
      body: row.body,
      status: row.status,
      replyCount: row.replies.length,
      replies: withReplies
        ? row.replies.map(
            (r): MentorReply => ({
              id: r.id,
              threadId: r.threadId,
              authorUserId: r.authorUserId,
              authorName: r.author.displayName,
              authorIsPlaced:
                r.author.studentProfile?.placementStatus === "PLACED",
              authorRole: r.author.role,
              body: r.body,
              createdAt: r.createdAt.toISOString(),
            }),
          )
        : undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
