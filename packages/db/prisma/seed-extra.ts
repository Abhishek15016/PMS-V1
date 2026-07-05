import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * Adds a large, realistic Indian-college dataset on top of the minimal
 * seed.ts fixture, purely for manually testing the deployed demo instance.
 * Not run in CI (seed.ts's e2e-test fixtures stay untouched) — run by hand
 * with a superuser DATABASE_URL, same as seed.ts, since it writes across
 * departments/batches without going through TenantPrismaService.
 */

const prisma = new PrismaClient();
const TENANT_SLUG = "demo-college";

const MALE_FIRST = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan",
  "Krishna", "Ishaan", "Rohan", "Karan", "Aman", "Rahul", "Amit", "Vikram",
  "Nikhil", "Siddharth", "Varun", "Abhishek",
];
const FEMALE_FIRST = [
  "Ananya", "Diya", "Saanvi", "Aadhya", "Kavya", "Ishita", "Riya", "Priya",
  "Sneha", "Neha", "Pooja", "Divya", "Meera", "Anjali", "Shreya", "Kritika",
  "Nisha", "Swati", "Radhika", "Aditi",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Kumar", "Singh", "Reddy", "Nair", "Iyer",
  "Patel", "Joshi", "Mehta", "Rao", "Chowdhury", "Das", "Bose", "Pillai",
  "Menon", "Naidu", "Agarwal", "Bhat",
];
const CATEGORIES = ["General", "General", "OBC", "SC", "ST", "EWS"];

const NEW_DEPARTMENTS = [
  { code: "EEE", name: "Electrical & Electronics Engineering" },
  { code: "CIVIL", name: "Civil Engineering" },
  { code: "IT", name: "Information Technology" },
];
const ALL_DEPT_CODES = ["CSE", "ECE", "MECH", "EEE", "CIVIL", "IT"];
const STUDENTS_PER_DEPT_PER_BATCH = 8;

type CompanySpec = {
  name: string;
  sector: string;
  tier: string;
  website: string;
  title: string;
  ctcLpa: number;
  slab: "NON_DREAM" | "SUPER_DREAM" | "DREAM";
  programs: string[];
  minCgpa: number;
  maxActiveBacklogs: number;
  roundTypes: Array<"APTITUDE" | "CODING" | "GD" | "TECHNICAL" | "HR">;
  driveStatus: "COMPLETED" | "ONGOING" | "SCHEDULED";
};

const COMPANIES: CompanySpec[] = [
  { name: "Tata Consultancy Services", sector: "IT Services", tier: "tier-1", website: "https://tcs.com", title: "Assistant System Engineer", ctcLpa: 3.6, slab: "NON_DREAM", programs: ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"], minCgpa: 6.0, maxActiveBacklogs: 1, roundTypes: ["APTITUDE", "TECHNICAL", "HR"], driveStatus: "COMPLETED" },
  { name: "Infosys", sector: "IT Services", tier: "tier-1", website: "https://infosys.com", title: "Systems Engineer", ctcLpa: 4.0, slab: "NON_DREAM", programs: ["CSE", "IT", "ECE", "EEE"], minCgpa: 6.5, maxActiveBacklogs: 1, roundTypes: ["APTITUDE", "TECHNICAL", "HR"], driveStatus: "COMPLETED" },
  { name: "Wipro", sector: "IT Services", tier: "tier-2", website: "https://wipro.com", title: "Project Engineer", ctcLpa: 3.5, slab: "NON_DREAM", programs: ["CSE", "IT", "ECE"], minCgpa: 6.0, maxActiveBacklogs: 1, roundTypes: ["APTITUDE", "TECHNICAL", "HR"], driveStatus: "COMPLETED" },
  { name: "Accenture", sector: "Consulting", tier: "tier-1", website: "https://accenture.com", title: "Associate Software Engineer", ctcLpa: 4.5, slab: "NON_DREAM", programs: ["CSE", "IT", "ECE", "EEE"], minCgpa: 6.5, maxActiveBacklogs: 0, roundTypes: ["APTITUDE", "GD", "HR"], driveStatus: "COMPLETED" },
  { name: "Cognizant", sector: "IT Services", tier: "tier-2", website: "https://cognizant.com", title: "Programmer Analyst", ctcLpa: 4.0, slab: "NON_DREAM", programs: ["CSE", "IT", "ECE"], minCgpa: 6.0, maxActiveBacklogs: 1, roundTypes: ["APTITUDE", "TECHNICAL", "HR"], driveStatus: "ONGOING" },
  { name: "Larsen & Toubro", sector: "Core Engineering", tier: "tier-2", website: "https://larsentoubro.com", title: "Graduate Engineer Trainee", ctcLpa: 6.0, slab: "NON_DREAM", programs: ["MECH", "CIVIL", "EEE"], minCgpa: 6.5, maxActiveBacklogs: 0, roundTypes: ["APTITUDE", "TECHNICAL", "HR"], driveStatus: "COMPLETED" },
  { name: "Siemens", sector: "Core Engineering", tier: "tier-1", website: "https://siemens.com", title: "Graduate Engineer Trainee", ctcLpa: 9.0, slab: "SUPER_DREAM", programs: ["EEE", "MECH", "ECE"], minCgpa: 7.5, maxActiveBacklogs: 0, roundTypes: ["TECHNICAL", "TECHNICAL", "HR"], driveStatus: "ONGOING" },
  { name: "Zoho Corporation", sector: "Product", tier: "tier-1", website: "https://zoho.com", title: "Member of Technical Staff", ctcLpa: 8.5, slab: "SUPER_DREAM", programs: ["CSE", "IT"], minCgpa: 7.5, maxActiveBacklogs: 0, roundTypes: ["CODING", "TECHNICAL", "HR"], driveStatus: "ONGOING" },
  { name: "Flipkart", sector: "E-commerce", tier: "tier-1", website: "https://flipkart.com", title: "SDE-1", ctcLpa: 22.0, slab: "SUPER_DREAM", programs: ["CSE", "IT"], minCgpa: 8.0, maxActiveBacklogs: 0, roundTypes: ["CODING", "TECHNICAL", "HR"], driveStatus: "SCHEDULED" },
  { name: "Amazon", sector: "Product", tier: "tier-1", website: "https://amazon.com", title: "SDE-1", ctcLpa: 32.0, slab: "DREAM", programs: ["CSE", "IT", "ECE"], minCgpa: 8.0, maxActiveBacklogs: 0, roundTypes: ["CODING", "TECHNICAL", "TECHNICAL", "HR"], driveStatus: "SCHEDULED" },
  { name: "Microsoft", sector: "Product", tier: "tier-1", website: "https://microsoft.com", title: "Software Engineer", ctcLpa: 42.0, slab: "DREAM", programs: ["CSE", "IT", "ECE"], minCgpa: 8.5, maxActiveBacklogs: 0, roundTypes: ["CODING", "TECHNICAL", "HR"], driveStatus: "SCHEDULED" },
  { name: "Google", sector: "Product", tier: "tier-1", website: "https://google.com", title: "Software Engineer", ctcLpa: 48.0, slab: "DREAM", programs: ["CSE", "IT"], minCgpa: 8.5, maxActiveBacklogs: 0, roundTypes: ["CODING", "TECHNICAL", "TECHNICAL", "HR"], driveStatus: "SCHEDULED" },
];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  const institution = await prisma.institution.findUniqueOrThrow({ where: { slug: TENANT_SLUG } });

  const already = await prisma.company.findFirst({
    where: { tenantId: institution.id, name: "Zoho Corporation" },
  });
  if (already) {
    console.log("Extra seed already applied — skipping (delete companies to re-run).");
    return;
  }

  // --- Departments -------------------------------------------------------
  const deptMap = new Map<string, string>();
  for (const d of await prisma.department.findMany({ where: { tenantId: institution.id } })) {
    deptMap.set(d.code, d.id);
  }
  for (const spec of NEW_DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { tenantId_code: { tenantId: institution.id, code: spec.code } },
      update: {},
      create: { tenantId: institution.id, code: spec.code, name: spec.name },
    });
    deptMap.set(spec.code, row.id);
  }

  // --- Batches -------------------------------------------------------------
  const currentBatch = await prisma.academicBatch.findFirstOrThrow({
    where: { tenantId: institution.id, label: "2022-2026" },
  });
  const seniorBatch = await prisma.academicBatch.upsert({
    where: { tenantId_label: { tenantId: institution.id, label: "2021-2025" } },
    update: {},
    create: { tenantId: institution.id, label: "2021-2025", startYear: 2021, endYear: 2025 },
  });
  const batches = [
    { id: currentBatch.id, label: "2022-2026", placedFraction: 0.3 },
    { id: seniorBatch.id, label: "2021-2025", placedFraction: 0.7 },
  ];

  // --- Students + Users ------------------------------------------------------
  const studentRows: Array<{ id: string; userId: string; departmentId: string; batchId: string; batchLabel: string; cgpa: number; activeBacklogs: number }> = [];
  let idx = 0;

  for (const batch of batches) {
    for (const deptCode of ALL_DEPT_CODES) {
      const deptId = deptMap.get(deptCode)!;
      for (let i = 0; i < STUDENTS_PER_DEPT_PER_BATCH; i++) {
        const isMale = idx % 2 === 0;
        const first = isMale ? MALE_FIRST[idx % MALE_FIRST.length] : FEMALE_FIRST[idx % FEMALE_FIRST.length];
        const last = LAST_NAMES[(idx * 7 + 3) % LAST_NAMES.length];
        const email = `${first.toLowerCase()}.${last.toLowerCase()}${idx}@demo-college.edu`;
        const userId = randomUUID();
        const studentId = randomUUID();
        const cgpa = Math.round((6 + ((idx * 37) % 41) / 10) * 100) / 100; // 6.00 - 10.00
        const activeBacklogs = idx % 11 === 0 ? 1 : 0;
        const backlogHistory = activeBacklogs + (idx % 17 === 0 ? 1 : 0);
        const placedThreshold = Math.round(batch.placedFraction * 10);
        const isPlaced = idx % 10 < placedThreshold;

        await prisma.user.create({
          data: {
            id: userId, tenantId: institution.id, email, displayName: `${first} ${last}`,
            role: "STUDENT", departmentId: deptId, authProvider: "stub", status: "ACTIVE",
          },
        });
        studentRows.push({ id: studentId, userId, departmentId: deptId, batchId: batch.id, batchLabel: batch.label, cgpa, activeBacklogs });

        await prisma.student.create({
          data: {
            id: studentId,
            tenantId: institution.id,
            userId,
            departmentId: deptId,
            batchId: batch.id,
            rollNumber: `${deptCode}${batch.label.slice(2, 4)}${String(i + 1).padStart(3, "0")}`,
            cgpa,
            tenthPercent: 70 + (idx % 28),
            twelfthPercent: 65 + (idx % 32),
            activeBacklogs,
            backlogHistory,
            gapYears: idx % 23 === 0 ? 1 : 0,
            diplomaFlag: false,
            category: CATEGORIES[idx % CATEGORIES.length],
            placementStatus: isPlaced ? "PLACED" : "UNPLACED",
          },
        });
        idx++;
      }
    }
  }
  console.log(`Created ${studentRows.length} students across ${ALL_DEPT_CODES.length} departments and ${batches.length} batches.`);

  // --- Companies, recruiters, JDs, drives, rounds --------------------------
  let driveCount = 0;
  let roundCount = 0;
  const driveInfos: Array<{ driveId: string; roundIds: string[]; roundTypes: string[]; status: string; programs: string[]; minCgpa: number; maxActiveBacklogs: number; ctcLpa: number; slab: string }> = [];

  for (const spec of COMPANIES) {
    const company = await prisma.company.create({
      data: { tenantId: institution.id, name: spec.name, sector: spec.sector, tier: spec.tier, website: spec.website },
    });
    const recruiterEmail = `recruiter.${slugify(spec.name)}@demo-college.edu`;
    await prisma.user.create({
      data: {
        tenantId: institution.id, email: recruiterEmail, displayName: `${spec.name} Recruiting Team`,
        role: "RECRUITER", companyId: company.id, authProvider: "stub", status: "ACTIVE",
      },
    });
    const jd = await prisma.jobDescription.create({
      data: {
        tenantId: institution.id, companyId: company.id, title: spec.title, ctcLpa: spec.ctcLpa,
        slab: spec.slab, eligiblePrograms: spec.programs,
        minCriteria: { minCgpa: spec.minCgpa, maxActiveBacklogs: spec.maxActiveBacklogs },
        location: "Bengaluru", bondMonths: 0,
      },
    });
    const scheduledAt =
      spec.driveStatus === "COMPLETED"
        ? new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
        : spec.driveStatus === "ONGOING"
          ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
    const drive = await prisma.drive.create({
      data: { tenantId: institution.id, jdId: jd.id, status: spec.driveStatus, scheduledAt },
    });
    driveCount++;
    const roundIds: string[] = [];
    for (let p = 0; p < spec.roundTypes.length; p++) {
      const round = await prisma.round.create({
        data: { tenantId: institution.id, driveId: drive.id, type: spec.roundTypes[p], position: p + 1 },
      });
      roundIds.push(round.id);
      roundCount++;
    }
    driveInfos.push({
      driveId: drive.id, roundIds, roundTypes: spec.roundTypes, status: spec.driveStatus,
      programs: spec.programs, minCgpa: spec.minCgpa, maxActiveBacklogs: spec.maxActiveBacklogs,
      ctcLpa: spec.ctcLpa, slab: spec.slab,
    });
  }
  console.log(`Created ${COMPANIES.length} companies/recruiters/JDs, ${driveCount} drives, ${roundCount} rounds.`);

  // --- Applications, round results, offers ---------------------------------
  const deptIdToCode = new Map<string, string>();
  for (const [code, id] of deptMap) deptIdToCode.set(id, code);

  let appCount = 0;
  let resultCount = 0;
  let offerCount = 0;

  for (const drive of driveInfos) {
    const eligibleStudents = studentRows.filter((s) =>
      drive.programs.includes(deptIdToCode.get(s.departmentId) ?? ""),
    );
    let applicantIdx = 0;
    for (const student of eligibleStudents) {
      // ~55% of eligible students apply to each drive
      if (applicantIdx % 20 >= 11) {
        applicantIdx++;
        continue;
      }
      const meetsBar = student.cgpa >= drive.minCgpa && student.activeBacklogs <= drive.maxActiveBacklogs;
      let status: string;
      if (drive.status === "SCHEDULED") {
        status = "APPLIED";
      } else if (!meetsBar) {
        status = applicantIdx % 7 === 0 ? "WITHDRAWN" : "REJECTED";
      } else if (drive.status === "ONGOING") {
        status = applicantIdx % 3 === 0 ? "IN_ROUND" : "SHORTLISTED";
      } else {
        // COMPLETED
        status = applicantIdx % 6 === 0 ? "SELECTED" : "REJECTED";
      }

      const application = await prisma.application.create({
        data: { tenantId: institution.id, studentId: student.id, driveId: drive.driveId, status: status as never },
      });
      appCount++;

      if (drive.status !== "SCHEDULED") {
        const roundsToRecord =
          drive.status === "ONGOING" ? Math.max(1, applicantIdx % drive.roundIds.length) : drive.roundIds.length;
        for (let r = 0; r < roundsToRecord; r++) {
          const isLastRound = r === drive.roundIds.length - 1;
          const passed = meetsBar && (status === "SELECTED" || status === "IN_ROUND" || status === "SHORTLISTED" || !isLastRound);
          await prisma.roundResult.create({
            data: {
              tenantId: institution.id, applicationId: application.id, roundId: drive.roundIds[r],
              status: passed ? "PASS" : "FAIL", score: passed ? 60 + (applicantIdx % 35) : 20 + (applicantIdx % 30),
              recordedAt: new Date(),
            },
          });
          resultCount++;
        }
      }

      if (status === "SELECTED") {
        const offerStatus = applicantIdx % 4 === 0 ? "REJECTED" : applicantIdx % 4 === 1 ? "EXTENDED" : "ACCEPTED";
        await prisma.offer.create({
          data: {
            tenantId: institution.id, studentId: student.id, applicationId: application.id,
            ctcLpa: drive.ctcLpa, slab: drive.slab as never, status: offerStatus as never,
            respondedAt: offerStatus === "EXTENDED" ? null : new Date(),
          },
        });
        offerCount++;
      }
      applicantIdx++;
    }
  }
  console.log(`Created ${appCount} applications, ${resultCount} round results, ${offerCount} offers.`);

  // --- Policy rules ----------------------------------------------------------
  await prisma.policyRule.create({
    data: {
      tenantId: institution.id, type: "ELIGIBILITY_CRITERIA", name: "Institution-wide minimum eligibility",
      version: 1, status: "ACTIVE",
      definition: { minCgpa: 6.0, maxActiveBacklogs: 1, maxBacklogHistory: 3, maxGapYears: 1, allowDiploma: false },
      effectiveFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.policyRule.create({
    data: {
      tenantId: institution.id, type: "SLAB_DEFINITION", name: "Default CTC slab thresholds",
      version: 1, status: "ACTIVE",
      definition: { superDreamMinCtc: 8, dreamMinCtc: 25 },
      effectiveFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.policyRule.create({
    data: {
      tenantId: institution.id, type: "OFFER_CAP", name: "One offer per slab tier",
      version: 1, status: "ACTIVE",
      definition: { oneOfferPerSlabTier: true },
      effectiveFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("Created 3 policy rules (eligibility, slab, offer cap).");

  console.log("Extra Indian sample dataset seeded successfully.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
