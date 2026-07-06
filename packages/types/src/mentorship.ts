import { z } from "zod";

export const ThreadStatusSchema = z.enum(["OPEN", "ANSWERED"]);
export type ThreadStatus = z.infer<typeof ThreadStatusSchema>;

/** Directory card: a placed, opted-in student plus the offer that placed them. */
export const MentorCardSchema = z.object({
  studentId: z.string(),
  displayName: z.string(),
  departmentCode: z.string(),
  batchLabel: z.string(),
  headline: z.string().nullable(),
  companyName: z.string().nullable(),
  companyWebsite: z.string().nullable(),
  ctcLpa: z.number().nullable(),
  slab: z.string().nullable(),
  isPpo: z.boolean(),
  answeredCount: z.number(),
});
export type MentorCard = z.infer<typeof MentorCardSchema>;

export const MentorReplySchema = z.object({
  id: z.string(),
  threadId: z.string(),
  authorUserId: z.string(),
  authorName: z.string(),
  authorIsPlaced: z.boolean(),
  authorRole: z.string(),
  body: z.string(),
  createdAt: z.string(),
});
export type MentorReply = z.infer<typeof MentorReplySchema>;

export const MentorThreadSchema = z.object({
  id: z.string(),
  authorStudentId: z.string(),
  authorName: z.string(),
  mentorStudentId: z.string().nullable(),
  mentorName: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  status: ThreadStatusSchema,
  replyCount: z.number(),
  replies: z.array(MentorReplySchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MentorThread = z.infer<typeof MentorThreadSchema>;

export const CreateThreadInputSchema = z.object({
  title: z.string().min(8).max(160),
  body: z.string().min(20).max(4000),
  mentorStudentId: z.string().optional(),
});
export type CreateThreadInput = z.infer<typeof CreateThreadInputSchema>;

export const CreateReplyInputSchema = z.object({
  body: z.string().min(2).max(4000),
});
export type CreateReplyInput = z.infer<typeof CreateReplyInputSchema>;

export const UpdateMentorProfileInputSchema = z.object({
  mentorOptIn: z.boolean(),
  mentorHeadline: z.string().max(140).nullable().optional(),
});
export type UpdateMentorProfileInput = z.infer<typeof UpdateMentorProfileInputSchema>;
