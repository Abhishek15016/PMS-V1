import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Second top-up over seed-extra.ts for the deployed demo instance. Adds the
 * layers that make the analytics/dashboard actually light up, which
 * seed-extra.ts skipped because they're normally produced by runtime
 * machinery (BullMQ recompute worker, eligibility engine):
 *
 *   1. Ten more marquee Indian recruiters with CTC breakups, bonds, and
 *      varied locations — plus breakups/locations backfilled onto the
 *      existing JDs.
 *   2. Applications / round results / offers for the new drives.
 *   3. Coherence pass: every PLACED student holds a real ACCEPTED offer
 *      (some as PPOs), and every ACCEPTED offer implies PLACED.
 *   4. EligibilityEvaluation rows (student × JD, with per-rule reasons) —
 *      the summary SQL counts eligible students from this table.
 *   5. WhatsApp/email NotificationLog rows and AuditEvent rows.
 *   6. PlacementSummary recompute for every batch × (tenant-wide + each
 *      department), mirroring summary-recompute.service.ts SQL.
 *
 * Run by hand with a superuser DATABASE_URL, same as seed-extra.ts.
 * Guarded: skips if a company named "Zomato" already exists.
 */

const prisma = new PrismaClient();
const TENANT_SLUG = "demo-college";

type NewCompanySpec = {
  name: string;
  sector: string;
  tier: string;
  website: string;
  title: string;
  ctcLpa: number;
  breakup: Record<string, number | string>;
  slab: "NON_DREAM" | "SUPER_DREAM" | "DREAM";
  programs: string[];
  minCgpa: number;
  maxActiveBacklogs: number;
  location: string;
  bondMonths: number;
  roundTypes: Array<"APTITUDE" | "CODING" | "GD" | "TECHNICAL" | "HR">;
  driveStatus: "COMPLETED" | "ONGOING" | "SCHEDULED";
};

const NEW_COMPANIES: NewCompanySpec[] = [
  { name: "Zomato", sector: "Food-tech", tier: "tier-1", website: "https://zomato.com", title: "SDE I", ctcLpa: 16, breakup: { fixedLpa: 12, variableLpa: 2, esopsLpa: 2 }, slab: "SUPER_DREAM", programs: ["CSE", "IT"], minCgpa: 7.0, maxActiveBacklogs: 0, location: "Gurugram", bondMonths: 0, roundTypes: ["CODING", "TECHNICAL", "HR"], driveStatus: "ONGOING" },
  { name: "Swiggy", sector: "Food-tech", tier: "tier-1", website: "https://swiggy.com", title: "SDE I", ctcLpa: 18, breakup: { fixedLpa: 14, variableLpa: 2, esopsLpa: 2 }, slab: "SUPER_DREAM", programs: ["CSE", "IT"], minCgpa: 7.5, maxActiveBacklogs: 0, location: "Bengaluru", bondMonths: 0, roundTypes: ["CODING", "TECHNICAL", "HR"], driveStatus: "SCHEDULED" },
  { name: "Razorpay", sector: "Fintech", tier: "tier-1", website: "https://razorpay.com", title: "SDE 1 — Payments", ctcLpa: 21, breakup: { fixedLpa: 16, variableLpa: 2, esopsLpa: 3 }, slab: "SUPER_DREAM", programs: ["CSE", "IT", "ECE"], minCgpa: 7.5, maxActiveBacklogs: 0, location: "Bengaluru", bondMonths: 0, roundTypes: ["CODING", "TECHNICAL", "TECHNICAL", "HR"], driveStatus: "ONGOING" },
  { name: "CRED", sector: "Fintech", tier: "tier-1", website: "https://cred.club", title: "Backend Engineer", ctcLpa: 26, breakup: { fixedLpa: 20, variableLpa: 2, esopsLpa: 4 }, slab: "DREAM", programs: ["CSE", "IT"], minCgpa: 8.0, maxActiveBacklogs: 0, location: "Bengaluru", bondMonths: 0, roundTypes: ["CODING", "TECHNICAL", "HR"], driveStatus: "SCHEDULED" },
  { name: "PhonePe", sector: "Fintech", tier: "tier-1", website: "https://phonepe.com", title: "Software Engineer", ctcLpa: 24, breakup: { fixedLpa: 18, variableLpa: 3, esopsLpa: 3 }, slab: "SUPER_DREAM", programs: ["CSE", "IT"], minCgpa: 8.0, maxActiveBacklogs: 0, location: "Bengaluru", bondMonths: 0, roundTypes: ["CODING", "TECHNICAL", "HR"], driveStatus: "COMPLETED" },
  { name: "Freshworks", sector: "SaaS", tier: "tier-1", website: "https://freshworks.com", title: "Graduate Engineer", ctcLpa: 10, breakup: { fixedLpa: 8.5, variableLpa: 1, joiningBonusLpa: 0.5 }, slab: "SUPER_DREAM", programs: ["CSE", "IT", "ECE"], minCgpa: 7.0, maxActiveBacklogs: 0, location: "Chennai", bondMonths: 0, roundTypes: ["CODING", "TECHNICAL", "HR"], driveStatus: "COMPLETED" },
  { name: "Deloitte", sector: "Consulting", tier: "tier-1", website: "https://deloitte.com", title: "Analyst", ctcLpa: 7.6, breakup: { fixedLpa: 7, variableLpa: 0.6 }, slab: "NON_DREAM", programs: ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"], minCgpa: 6.5, maxActiveBacklogs: 0, location: "Hyderabad", bondMonths: 0, roundTypes: ["APTITUDE", "GD", "HR"], driveStatus: "COMPLETED" },
  { name: "Bosch", sector: "Core Engineering", tier: "tier-1", website: "https://bosch.in", title: "Associate Software Engineer", ctcLpa: 8, breakup: { fixedLpa: 7.2, variableLpa: 0.8 }, slab: "SUPER_DREAM", programs: ["ECE", "EEE", "MECH"], minCgpa: 7.0, maxActiveBacklogs: 0, location: "Coimbatore", bondMonths: 24, roundTypes: ["APTITUDE", "TECHNICAL", "HR"], driveStatus: "ONGOING" },
  { name: "Qualcomm", sector: "Semiconductors", tier: "tier-1", website: "https://qualcomm.com", title: "Engineer", ctcLpa: 19, breakup: { fixedLpa: 15, variableLpa: 2, joiningBonusLpa: 2 }, slab: "SUPER_DREAM", programs: ["ECE", "EEE", "CSE"], minCgpa: 8.0, maxActiveBacklogs: 0, location: "Hyderabad", bondMonths: 0, roundTypes: ["APTITUDE", "TECHNICAL", "TECHNICAL", "HR"], driveStatus: "SCHEDULED" },
  { name: "Goldman Sachs", sector: "BFSI", tier: "tier-1", website: "https://goldmansachs.com", title: "Analyst — Engineering", ctcLpa: 33, breakup: { fixedLpa: 24, variableLpa: 6, joiningBonusLpa: 3 }, slab: "DREAM", programs: ["CSE", "IT", "ECE"], minCgpa: 8.5, maxActiveBacklogs: 0, location: "Bengaluru", bondMonths: 0, roundTypes: ["CODING", "TECHNICAL", "TECHNICAL", "HR"], driveStatus: "SCHEDULED" },
];

/** Breakups for the seed-extra.ts JDs that shipped with ctcBreakup=null. */
const EXISTING_JD_DETAILS: Record<string, { breakup: Record<string, number>; location: string; bondMonths: number }> = {
  "Tata Consultancy Services": { breakup: { fixedLpa: 3.36, variableLpa: 0.24 }, location: "Mumbai", bondMonths: 12 },
  Infosys: { breakup: { fixedLpa: 3.7, variableLpa: 0.3 }, location: "Mysuru", bondMonths: 12 },
  Wipro: { breakup: { fixedLpa: 3.3, variableLpa: 0.2 }, location: "Pune", bondMonths: 15 },
  Accenture: { breakup: { fixedLpa: 4.2, variableLpa: 0.3 }, location: "Bengaluru", bondMonths: 0 },
  Cognizant: { breakup: { fixedLpa: 3.8, variableLpa: 0.2 }, location: "Chennai", bondMonths: 12 },
  "Larsen & Toubro": { breakup: { fixedLpa: 5.5, variableLpa: 0.5 }, location: "Chennai", bondMonths: 24 },
  Siemens: { breakup: { fixedLpa: 8.2, variableLpa: 0.8 }, location: "Pune", bondMonths: 0 },
  "Zoho Corporation": { breakup: { fixedLpa: 8.0, variableLpa: 0.5 }, location: "Chennai", bondMonths: 0 },
  Flipkart: { breakup: { fixedLpa: 16, variableLpa: 2, esopsLpa: 4 }, location: "Bengaluru", bondMonths: 0 },
  Amazon: { breakup: { fixedLpa: 20, variableLpa: 4, joiningBonusLpa: 8 }, location: "Hyderabad", bondMonths: 0 },
  Microsoft: { breakup: { fixedLpa: 26, variableLpa: 6, esopsLpa: 10 }, location: "Hyderabad", bondMonths: 0 },
  Google: { breakup: { fixedLpa: 28, variableLpa: 8, esopsLpa: 12 }, location: "Bengaluru", bondMonths: 0 },
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  const institution = await prisma.institution.findUniqueOrThrow({ where: { slug: TENANT_SLUG } });
  const tenantId = institution.id;

  const already = await prisma.company.findFirst({ where: { tenantId, name: "Zomato" } });
  if (already) {
    console.log("seed-extra2 already applied — skipping.");
    return;
  }

  const departments = await prisma.department.findMany({ where: { tenantId } });
  const deptIdToCode = new Map(departments.map((d) => [d.id, d.code]));

  const students = await prisma.student.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, departmentId: true, batchId: true, cgpa: true, activeBacklogs: true, placementStatus: true },
  });

  // --- 1 + 2. New companies with full drive pipelines ----------------------
  let appCount = 0;
  let offerCount = 0;
  const newJdIds: string[] = [];

  for (const spec of NEW_COMPANIES) {
    const company = await prisma.company.create({
      data: { tenantId, name: spec.name, sector: spec.sector, tier: spec.tier, website: spec.website },
    });
    await prisma.user.create({
      data: {
        tenantId, email: `recruiter.${slugify(spec.name)}@demo-college.edu`,
        displayName: `${spec.name} Recruiting Team`, role: "RECRUITER",
        companyId: company.id, authProvider: "stub", status: "ACTIVE",
      },
    });
    const jd = await prisma.jobDescription.create({
      data: {
        tenantId, companyId: company.id, title: spec.title, ctcLpa: spec.ctcLpa,
        ctcBreakup: spec.breakup, slab: spec.slab, eligiblePrograms: spec.programs,
        minCriteria: { minCgpa: spec.minCgpa, maxActiveBacklogs: spec.maxActiveBacklogs },
        location: spec.location, bondMonths: spec.bondMonths,
      },
    });
    newJdIds.push(jd.id);
    const scheduledAt =
      spec.driveStatus === "COMPLETED"
        ? new Date(Date.now() - (20 + newJdIds.length * 3) * 24 * 60 * 60 * 1000)
        : spec.driveStatus === "ONGOING"
          ? new Date(Date.now() - (2 + newJdIds.length) * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + (7 + newJdIds.length * 4) * 24 * 60 * 60 * 1000);
    const drive = await prisma.drive.create({
      data: { tenantId, jdId: jd.id, status: spec.driveStatus, scheduledAt },
    });
    const roundIds: string[] = [];
    for (let p = 0; p < spec.roundTypes.length; p++) {
      const round = await prisma.round.create({
        data: { tenantId, driveId: drive.id, type: spec.roundTypes[p], position: p + 1 },
      });
      roundIds.push(round.id);
    }

    // Applications + round results + offers, same heuristics as seed-extra.ts
    const eligibleStudents = students.filter((s) =>
      spec.programs.includes(deptIdToCode.get(s.departmentId) ?? ""),
    );
    let applicantIdx = 0;
    for (const student of eligibleStudents) {
      if (applicantIdx % 20 >= 11) {
        applicantIdx++;
        continue;
      }
      const cgpa = Number(student.cgpa ?? 0);
      const meetsBar = cgpa >= spec.minCgpa && student.activeBacklogs <= spec.maxActiveBacklogs;
      let status: string;
      if (spec.driveStatus === "SCHEDULED") status = "APPLIED";
      else if (!meetsBar) status = applicantIdx % 7 === 0 ? "WITHDRAWN" : "REJECTED";
      else if (spec.driveStatus === "ONGOING") status = applicantIdx % 3 === 0 ? "IN_ROUND" : "SHORTLISTED";
      else status = applicantIdx % 6 === 0 ? "SELECTED" : "REJECTED";

      const application = await prisma.application.create({
        data: { tenantId, studentId: student.id, driveId: drive.id, status: status as never },
      });
      appCount++;

      if (spec.driveStatus !== "SCHEDULED") {
        const roundsToRecord =
          spec.driveStatus === "ONGOING" ? Math.max(1, applicantIdx % roundIds.length) : roundIds.length;
        const resultRows = [];
        for (let r = 0; r < roundsToRecord; r++) {
          const isLastRound = r === roundIds.length - 1;
          const passed = meetsBar && (status !== "REJECTED" || !isLastRound);
          resultRows.push({
            tenantId, applicationId: application.id, roundId: roundIds[r],
            status: (passed ? "PASS" : "FAIL") as never,
            score: new Prisma.Decimal(passed ? 60 + (applicantIdx % 35) : 20 + (applicantIdx % 30)),
            recordedAt: new Date(),
          });
        }
        await prisma.roundResult.createMany({ data: resultRows });
      }

      if (status === "SELECTED") {
        const offerStatus = applicantIdx % 4 === 0 ? "REJECTED" : applicantIdx % 4 === 1 ? "EXTENDED" : "ACCEPTED";
        await prisma.offer.create({
          data: {
            tenantId, studentId: student.id, applicationId: application.id,
            ctcLpa: spec.ctcLpa, slab: spec.slab as never, status: offerStatus as never,
            respondedAt: offerStatus === "EXTENDED" ? null : new Date(),
          },
        });
        offerCount++;
      }
      applicantIdx++;
    }
  }
  console.log(`New companies: ${NEW_COMPANIES.length}, applications: ${appCount}, offers: ${offerCount}`);

  // --- Backfill breakup/location/bond onto existing JDs ---------------------
  const companies = await prisma.company.findMany({ where: { tenantId }, include: { jobDescriptions: true } });
  for (const c of companies) {
    const details = EXISTING_JD_DETAILS[c.name];
    if (!details) continue;
    for (const jd of c.jobDescriptions) {
      if (jd.ctcBreakup === null) {
        await prisma.jobDescription.update({
          where: { id: jd.id },
          data: { ctcBreakup: details.breakup, location: details.location, bondMonths: details.bondMonths },
        });
      }
    }
  }
  console.log("Backfilled CTC breakups/locations/bonds onto existing JDs.");

  // --- 3. Coherence pass: placementStatus <-> accepted offers ---------------
  const acceptedOffers = await prisma.offer.findMany({
    where: { tenantId, status: "ACCEPTED" },
    select: { studentId: true },
  });
  const acceptedStudentIds = new Set(acceptedOffers.map((o) => o.studentId));

  // (a) ACCEPTED offer but marked UNPLACED → mark PLACED
  const fixedUp = await prisma.student.updateMany({
    where: { tenantId, id: { in: [...acceptedStudentIds] }, placementStatus: "UNPLACED" },
    data: { placementStatus: "PLACED" },
  });

  // (b) PLACED but no accepted offer → give them one (every 4th as a PPO)
  const allJds = await prisma.jobDescription.findMany({
    where: { tenantId },
    select: { id: true, ctcLpa: true, slab: true, eligiblePrograms: true, companyId: true },
  });
  const placedNoOffer = students.filter(
    (s) => s.placementStatus === "PLACED" && !acceptedStudentIds.has(s.id),
  );
  let ppoCount = 0;
  let backfilledOffers = 0;
  for (let i = 0; i < placedNoOffer.length; i++) {
    const s = placedNoOffer[i];
    const code = deptIdToCode.get(s.departmentId) ?? "";
    const candidates = allJds.filter((jd) => jd.eligiblePrograms.includes(code));
    if (candidates.length === 0) continue;
    const jd = candidates[i % candidates.length];
    const isPpo = i % 4 === 0;
    await prisma.offer.create({
      data: {
        tenantId, studentId: s.id, applicationId: null,
        ctcLpa: jd.ctcLpa, slab: jd.slab, status: "ACCEPTED",
        isPpo, sourceInternshipId: isPpo ? `intern-2025-${String(i + 1).padStart(3, "0")}` : null,
        respondedAt: new Date(Date.now() - (i % 30) * 24 * 60 * 60 * 1000),
      },
    });
    backfilledOffers++;
    if (isPpo) ppoCount++;
  }
  console.log(
    `Coherence: ${fixedUp.count} students flipped to PLACED, ${backfilledOffers} accepted offers backfilled (${ppoCount} PPOs).`,
  );

  // --- 4. Eligibility evaluations -------------------------------------------
  const activePolicy = await prisma.policyRule.findFirst({
    where: { tenantId, type: "ELIGIBILITY_CRITERIA", status: "ACTIVE" },
  });
  const evalRows: Prisma.EligibilityEvaluationCreateManyInput[] = [];
  for (const s of students) {
    const code = deptIdToCode.get(s.departmentId) ?? "";
    const cgpa = Number(s.cgpa ?? 0);
    for (const jd of allJds) {
      if (!jd.eligiblePrograms.includes(code)) continue;
      const minCriteria = { minCgpa: 6.0, maxActiveBacklogs: 1 };
      const cgpaOk = cgpa >= minCriteria.minCgpa;
      const backlogOk = s.activeBacklogs <= minCriteria.maxActiveBacklogs;
      evalRows.push({
        tenantId,
        studentId: s.id,
        jdId: jd.id,
        ruleVersion: activePolicy?.id ?? null,
        result: cgpaOk && backlogOk,
        reasons: [
          { ruleCode: "MIN_CGPA", ruleLabel: "Minimum CGPA", passed: cgpaOk, expected: `>= ${minCriteria.minCgpa}`, actual: cgpa.toFixed(2), message: cgpaOk ? "CGPA requirement met" : "CGPA below institutional minimum" },
          { ruleCode: "MAX_ACTIVE_BACKLOGS", ruleLabel: "Active backlogs", passed: backlogOk, expected: `<= ${minCriteria.maxActiveBacklogs}`, actual: String(s.activeBacklogs), message: backlogOk ? "Backlog requirement met" : "Too many active backlogs" },
        ],
        evaluatedAt: new Date(),
      });
    }
  }
  // Insert in chunks to stay under parameter limits over the wire.
  for (let i = 0; i < evalRows.length; i += 500) {
    await prisma.eligibilityEvaluation.createMany({
      data: evalRows.slice(i, i + 500),
      skipDuplicates: true,
    });
  }
  console.log(`Eligibility evaluations inserted: ${evalRows.length}`);

  // --- 5. Notification logs + audit events ----------------------------------
  const someStudents = await prisma.student.findMany({
    where: { tenantId },
    select: { userId: true },
    take: 30,
  });
  const notifTemplates = [
    { channel: "WHATSAPP", templateRef: "drive.announcement", body: "New drive announced" },
    { channel: "WHATSAPP", templateRef: "application.shortlisted", body: "You have been shortlisted" },
    { channel: "EMAIL", templateRef: "offer.extended", body: "Offer letter released" },
    { channel: "WHATSAPP", templateRef: "round.reminder", body: "Round starts in 2 hours" },
    { channel: "EMAIL", templateRef: "drive.announcement", body: "New drive announced" },
  ] as const;
  await prisma.notificationLog.createMany({
    data: someStudents.flatMap((s, i) => {
      const t = notifTemplates[i % notifTemplates.length];
      return [{
        tenantId, userId: s.userId, channel: t.channel as never, templateRef: t.templateRef,
        payload: { body: t.body }, status: (i % 9 === 0 ? "SENT" : "DELIVERED") as never,
        sentAt: new Date(Date.now() - (i % 14) * 24 * 60 * 60 * 1000),
      }];
    }),
  });

  const tpo = await prisma.user.findFirst({ where: { tenantId, role: "TPO" } });
  await prisma.auditEvent.createMany({
    data: [
      { tenantId, actorUserId: tpo?.id ?? null, action: "policy.rule.activated", resourceType: "PolicyRule", metadata: { name: "Institution-wide minimum eligibility" } },
      { tenantId, actorUserId: tpo?.id ?? null, action: "drive.scheduled", resourceType: "Drive", metadata: { company: "Goldman Sachs" } },
      { tenantId, actorUserId: tpo?.id ?? null, action: "offer.approved", resourceType: "Offer", metadata: { company: "Microsoft", ctcLpa: 42 } },
      { tenantId, actorUserId: tpo?.id ?? null, action: "students.imported", resourceType: "ImportJob", metadata: { rows: 96, file: "batch-2022-26.xlsx" } },
      { tenantId, actorUserId: tpo?.id ?? null, action: "report.generated", resourceType: "PlacementSummary", metadata: { format: "NIRF" } },
    ],
  });
  console.log("Notification logs + audit events inserted.");

  // --- 6. PlacementSummary recompute (mirrors summary-recompute.service.ts) --
  const batches = await prisma.academicBatch.findMany({ where: { tenantId } });
  let summaryRows = 0;
  for (const batch of batches) {
    const deptsInBatch = await prisma.department.findMany({
      where: { tenantId, students: { some: { batchId: batch.id } } },
      select: { id: true },
    });
    const season = await prisma.$queryRaw<Array<{ active_drive_count: number; recruiter_count: number }>>(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM drives d
          WHERE d.tenant_id = ${tenantId} AND d.status IN ('SCHEDULED', 'ONGOING'))::int AS active_drive_count,
        (SELECT COUNT(DISTINCT jd.company_id) FROM drives d
          JOIN job_descriptions jd ON jd.id = d.jd_id
          WHERE d.tenant_id = ${tenantId} AND d.status IN ('SCHEDULED', 'ONGOING', 'COMPLETED'))::int AS recruiter_count
    `);
    const scopes: Array<string | null> = [null, ...deptsInBatch.map((d) => d.id)];
    for (const departmentId of scopes) {
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        WITH scoped_students AS (
          SELECT s.id, s.placement_status
          FROM students s
          WHERE s.tenant_id = ${tenantId}
            AND s.batch_id = ${batch.id}
            AND (${departmentId}::text IS NULL OR s.department_id = ${departmentId})
        ),
        eligible_students AS (
          SELECT DISTINCT e.student_id
          FROM eligibility_evaluations e
          WHERE e.tenant_id = ${tenantId}
            AND e.result = true
            AND e.student_id IN (SELECT id FROM scoped_students)
        ),
        scoped_applications AS (
          SELECT a.student_id, a.status
          FROM applications a
          WHERE a.tenant_id = ${tenantId}
            AND a.student_id IN (SELECT id FROM scoped_students)
        ),
        accepted_offers AS (
          SELECT o.ctc_lpa
          FROM offers o
          WHERE o.tenant_id = ${tenantId}
            AND o.status = 'ACCEPTED'
            AND o.student_id IN (SELECT id FROM scoped_students)
        )
        SELECT
          (SELECT COUNT(*) FROM scoped_students)::int AS total_students,
          (SELECT COUNT(*) FROM eligible_students)::int AS eligible_count,
          (SELECT COUNT(DISTINCT student_id) FROM scoped_applications)::int AS applied_count,
          (SELECT COUNT(DISTINCT student_id) FROM scoped_applications WHERE status = 'SHORTLISTED')::int AS shortlisted_count,
          (SELECT COUNT(DISTINCT student_id) FROM scoped_applications WHERE status = 'SELECTED')::int AS selected_count,
          (SELECT COUNT(*) FROM scoped_students WHERE placement_status = 'PLACED')::int AS placed_count,
          (SELECT COUNT(*) FROM scoped_students WHERE placement_status = 'UNPLACED')::int AS unplaced_count,
          (SELECT MAX(ctc_lpa) FROM accepted_offers) AS highest_ctc,
          (SELECT AVG(ctc_lpa) FROM accepted_offers) AS average_ctc,
          (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ctc_lpa) FROM accepted_offers) AS median_ctc
      `);
      const r = rows[0]! as {
        total_students: number; eligible_count: number; applied_count: number;
        shortlisted_count: number; selected_count: number; placed_count: number;
        unplaced_count: number; highest_ctc: unknown; average_ctc: unknown; median_ctc: unknown;
      };
      const data = {
        totalStudents: r.total_students,
        eligibleCount: r.eligible_count,
        appliedCount: r.applied_count,
        shortlistedCount: r.shortlisted_count,
        selectedCount: r.selected_count,
        placedCount: r.placed_count,
        unplacedCount: r.unplaced_count,
        highestCtc: r.highest_ctc === null ? null : new Prisma.Decimal(String(r.highest_ctc)),
        averageCtc: r.average_ctc === null ? null : new Prisma.Decimal(String(r.average_ctc)),
        medianCtc: r.median_ctc === null ? null : new Prisma.Decimal(String(r.median_ctc)),
        activeDriveCount: season[0]!.active_drive_count,
        recruiterCount: season[0]!.recruiter_count,
        computedAt: new Date(),
      };
      const existing = await prisma.placementSummary.findFirst({
        where: { tenantId, batchId: batch.id, departmentId },
      });
      if (existing) {
        await prisma.placementSummary.update({ where: { id: existing.id }, data });
      } else {
        await prisma.placementSummary.create({
          data: { tenantId, batchId: batch.id, departmentId, ...data },
        });
      }
      summaryRows++;
    }
  }
  console.log(`Placement summaries recomputed: ${summaryRows} rows.`);
  console.log("seed-extra2 complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
