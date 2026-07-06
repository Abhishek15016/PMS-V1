import { z } from "zod";

/** One structured resume per student. Section shapes are validated here
 * (API and web share this schema), not by the DB — the builder can evolve
 * without migrations. */

export const ResumeExperienceSchema = z.object({
  organization: z.string(),
  role: z.string(),
  period: z.string(), // free text: "Jun 2025 – Aug 2025"
  bullets: z.array(z.string()),
});
export type ResumeExperience = z.infer<typeof ResumeExperienceSchema>;

export const ResumeProjectSchema = z.object({
  name: z.string(),
  link: z.string().optional(),
  bullets: z.array(z.string()),
});
export type ResumeProject = z.infer<typeof ResumeProjectSchema>;

export const ResumeContentSchema = z.object({
  headline: z.string().max(120).default(""),
  summary: z.string().max(600).default(""),
  skills: z.array(z.string()).default([]),
  experience: z.array(ResumeExperienceSchema).default([]),
  projects: z.array(ResumeProjectSchema).default([]),
  achievements: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
});
export type ResumeContent = z.infer<typeof ResumeContentSchema>;

export const ResumeSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  studentId: z.string(),
  content: ResumeContentSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Resume = z.infer<typeof ResumeSchema>;

export const UpdateResumeInputSchema = z.object({
  content: ResumeContentSchema,
});
export type UpdateResumeInput = z.infer<typeof UpdateResumeInputSchema>;

export const UpdateStudentLinksInputSchema = z.object({
  linkedinUrl: z.string().url().nullable().optional(),
  githubUrl: z.string().url().nullable().optional(),
  leetcodeUrl: z.string().url().nullable().optional(),
  codeforcesUrl: z.string().url().nullable().optional(),
});
export type UpdateStudentLinksInput = z.infer<typeof UpdateStudentLinksInputSchema>;
