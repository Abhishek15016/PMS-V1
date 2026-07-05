import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_TENANT_SLUG = "demo-college";

const DEPARTMENTS = [
  { code: "CSE", name: "Computer Science & Engineering" },
  { code: "ECE", name: "Electronics & Communication Engineering" },
  { code: "MECH", name: "Mechanical Engineering" },
];

const BATCH = { label: "2022-2026", startYear: 2022, endYear: 2026 };

async function main() {
  const institution = await prisma.institution.upsert({
    where: { slug: DEMO_TENANT_SLUG },
    update: {},
    create: {
      name: "Demo College of Engineering",
      slug: DEMO_TENANT_SLUG,
      status: "ACTIVE",
    },
  });

  const departments = new Map<string, { id: string }>();
  for (const dept of DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { tenantId_code: { tenantId: institution.id, code: dept.code } },
      update: { name: dept.name },
      create: { tenantId: institution.id, code: dept.code, name: dept.name },
    });
    departments.set(dept.code, row);
  }
  const cse = departments.get("CSE")!;
  const ece = departments.get("ECE")!;

  const batch = await prisma.academicBatch.upsert({
    where: { tenantId_label: { tenantId: institution.id, label: BATCH.label } },
    update: {},
    create: { tenantId: institution.id, ...BATCH },
  });

  const DEMO_USERS: Array<{
    email: string;
    displayName: string;
    role: Role;
    departmentId?: string;
  }> = [
    { email: "super.admin@demo-college.edu", displayName: "Sam Super Admin", role: "SUPER_ADMIN" },
    { email: "tpo@demo-college.edu", displayName: "Priya TPO", role: "TPO" },
    {
      email: "faculty.cse@demo-college.edu",
      displayName: "Dr. Faculty Coordinator (CSE)",
      role: "FACULTY_COORD",
      departmentId: cse.id,
    },
    {
      email: "student@demo-college.edu",
      displayName: "Asha Student",
      role: "STUDENT",
      departmentId: cse.id,
    },
    {
      email: "student2.ece@demo-college.edu",
      displayName: "Vikram ECE Student",
      role: "STUDENT",
      departmentId: ece.id,
    },
    { email: "recruiter@demo-college.edu", displayName: "Rahul Recruiter", role: "RECRUITER" },
  ];

  const users = new Map<string, { id: string }>();
  for (const fixture of DEMO_USERS) {
    const row = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: institution.id, email: fixture.email } },
      update: {
        displayName: fixture.displayName,
        role: fixture.role,
        status: "ACTIVE",
        departmentId: fixture.departmentId,
      },
      create: {
        tenantId: institution.id,
        email: fixture.email,
        displayName: fixture.displayName,
        role: fixture.role,
        departmentId: fixture.departmentId,
        authProvider: "stub",
        status: "ACTIVE",
      },
    });
    users.set(fixture.email, row);
  }

  const studentUser = users.get("student@demo-college.edu")!;
  await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      tenantId: institution.id,
      userId: studentUser.id,
      departmentId: cse.id,
      batchId: batch.id,
      rollNumber: "CSE2022001",
      cgpa: 8.2,
      tenthPercent: 92.4,
      twelfthPercent: 88.0,
      activeBacklogs: 0,
      backlogHistory: 0,
      gapYears: 0,
      diplomaFlag: false,
      category: "General",
      placementStatus: "UNPLACED",
    },
  });

  const student2User = users.get("student2.ece@demo-college.edu")!;
  await prisma.student.upsert({
    where: { userId: student2User.id },
    update: {},
    create: {
      tenantId: institution.id,
      userId: student2User.id,
      departmentId: ece.id,
      batchId: batch.id,
      rollNumber: "ECE2022001",
      cgpa: 7.4,
      tenthPercent: 85.0,
      twelfthPercent: 80.5,
      activeBacklogs: 1,
      backlogHistory: 2,
      gapYears: 0,
      diplomaFlag: false,
      category: "General",
      placementStatus: "UNPLACED",
    },
  });

  const existingCompany = await prisma.company.findFirst({
    where: { tenantId: institution.id, name: "Acme Corp" },
  });
  const company =
    existingCompany ??
    (await prisma.company.create({
      data: {
        tenantId: institution.id,
        name: "Acme Corp",
        sector: "Software",
        tier: "tier-1",
        website: "https://acme.example.com",
      },
    }));

  const recruiterUser = users.get("recruiter@demo-college.edu")!;
  await prisma.user.update({
    where: { id: recruiterUser.id },
    data: { companyId: company.id },
  });

  const jdData = {
    ctcLpa: 12,
    eligiblePrograms: ["CSE", "ECE"],
    // Field names match EligibilityCriteriaDefinitionSchema (packages/types/src/policy-rules.ts)
    // exactly — the eligibility evaluators (slice 10) parse this JSON blob against that schema.
    minCriteria: { minCgpa: 7.0, maxActiveBacklogs: 0 },
    location: "Bengaluru",
    bondMonths: 0,
  };
  const existingJd = await prisma.jobDescription.findFirst({
    where: { tenantId: institution.id, companyId: company.id, title: "Software Engineer" },
  });
  const jd = existingJd
    ? await prisma.jobDescription.update({ where: { id: existingJd.id }, data: jdData })
    : await prisma.jobDescription.create({
        data: { tenantId: institution.id, companyId: company.id, title: "Software Engineer", ...jdData },
      });

  const existingDrive = await prisma.drive.findFirst({
    where: { tenantId: institution.id, jdId: jd.id },
  });
  const drive =
    existingDrive ??
    (await prisma.drive.create({
      data: {
        tenantId: institution.id,
        jdId: jd.id,
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    }));

  const roundSpecs: Array<{ type: "APTITUDE" | "TECHNICAL" | "HR"; position: number }> = [
    { type: "APTITUDE", position: 1 },
    { type: "TECHNICAL", position: 2 },
    { type: "HR", position: 3 },
  ];
  for (const spec of roundSpecs) {
    await prisma.round.upsert({
      where: { driveId_position: { driveId: drive.id, position: spec.position } },
      update: {},
      create: { tenantId: institution.id, driveId: drive.id, type: spec.type, position: spec.position },
    });
  }

  console.log(
    `Seeded tenant "${institution.slug}" (${institution.id}): ${DEMO_USERS.length} users, ` +
      `${DEPARTMENTS.length} departments, 1 batch, 2 student profiles (CSE + ECE), 1 company, 1 JD, 1 drive with 3 rounds. ` +
      `Log in via the SSO stub with tenantSlug="${DEMO_TENANT_SLUG}" and any of the seeded emails.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
