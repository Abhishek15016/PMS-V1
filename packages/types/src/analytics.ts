import { z } from "zod";

export const AnalyticsScopeSchema = z.enum(["FULL", "DEPARTMENT", "STUDENT"]);
export type AnalyticsScope = z.infer<typeof AnalyticsScopeSchema>;

export const SummaryResponseSchema = z.object({
  scope: AnalyticsScopeSchema,
  batchId: z.string(),
  departmentId: z.string().nullable(),
  totalStudents: z.number(),
  eligibleCount: z.number(),
  appliedCount: z.number(),
  shortlistedCount: z.number(),
  selectedCount: z.number(),
  placedCount: z.number(),
  unplacedCount: z.number(),
  placementPercent: z.number().nullable(),
  highestCtc: z.number().nullable(),
  medianCtc: z.number().nullable(),
  averageCtc: z.number().nullable(),
  activeDriveCount: z.number(),
  recruiterCount: z.number(),
  computedAt: z.string(),
});
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

export const RecruiterSummaryResponseSchema = z.object({
  scope: z.literal("RECRUITER"),
  companyId: z.string(),
  offersPending: z.number(),
  offersExtended: z.number(),
  offersAccepted: z.number(),
  offersRejected: z.number(),
});
export type RecruiterSummaryResponse = z.infer<typeof RecruiterSummaryResponseSchema>;

export const YoyResponseSchema = z.object({
  current: SummaryResponseSchema.nullable(),
  previous: SummaryResponseSchema.nullable(),
  placementPercentDelta: z.number().nullable(),
  medianCtcDelta: z.number().nullable(),
});
export type YoyResponse = z.infer<typeof YoyResponseSchema>;

export const DrilldownMetricSchema = z.enum([
  "eligible",
  "applied",
  "shortlisted",
  "selected",
  "placed",
  "unplaced",
  "accepted-offers",
]);
export type DrilldownMetric = z.infer<typeof DrilldownMetricSchema>;

export const DrilldownStudentRowSchema = z.object({
  id: z.string(),
  rollNumber: z.string().nullable(),
  departmentId: z.string(),
  placementStatus: z.string(),
});
export type DrilldownStudentRow = z.infer<typeof DrilldownStudentRowSchema>;

export const DrilldownOfferRowSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  ctcLpa: z.number(),
  slab: z.string().nullable(),
  isPpo: z.boolean(),
});
export type DrilldownOfferRow = z.infer<typeof DrilldownOfferRowSchema>;

export const FilterOptionsResponseSchema = z.object({
  batches: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      startYear: z.number(),
      endYear: z.number(),
    }),
  ),
  departments: z.array(
    z.object({ id: z.string(), code: z.string(), name: z.string() }),
  ),
});
export type FilterOptionsResponse = z.infer<typeof FilterOptionsResponseSchema>;

export const UpcomingDriveRowSchema = z.object({
  id: z.string(),
  jdTitle: z.string(),
  companyName: z.string(),
  scheduledAt: z.string().nullable(),
});
export type UpcomingDriveRow = z.infer<typeof UpcomingDriveRowSchema>;
