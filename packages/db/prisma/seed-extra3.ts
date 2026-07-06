import { PrismaClient } from "@prisma/client";

/**
 * Third top-up: Mentor Connect demo data. Opts placed students in as
 * mentors (headline derived from their real accepted offer) and seeds a
 * handful of realistic Q&A threads with replies. Guarded: skips if any
 * mentor is already opted in. Run by hand with a superuser DATABASE_URL.
 */

const prisma = new PrismaClient();
const TENANT_SLUG = "demo-college";

const QUESTIONS = [
  {
    title: "How did you prepare for the Razorpay coding rounds?",
    body: "I'm shortlisted for Razorpay's SDE 1 drive and the coding round is next week. Which topics did they weight most — DP, graphs, or design? And how strict were they about optimal complexity vs working code?",
    directed: true,
    reply:
      "Two LeetCode-medium problems in 60 minutes. They cared more about clean working code + tests than the absolute optimal answer. I got arrays/hashing and one BFS problem. Practice explaining while you code — the interviewer stayed on call the whole time.",
    answered: true,
  },
  {
    title: "Is the TCS bond really enforced? Worth accepting while waiting for product companies?",
    body: "I have a TCS ASE offer (3.6 LPA, 12-month service agreement) but I'm still in the pipeline for two product drives. Do seniors recommend accepting and continuing to interview, or does the offer-cap policy block that?",
    directed: false,
    reply:
      "Check the policy page first — our one-offer-per-slab rule means a NON_DREAM acceptance doesn't block a SUPER_DREAM/DREAM upgrade. That's exactly the path I took: accepted TCS in October, upgraded to Freshworks in January, no bond issue because I never joined.",
    answered: true,
  },
  {
    title: "Resume review: projects vs internship for core (mechanical) roles?",
    body: "For L&T / Bosch style core drives, does a workshop internship weigh more than software side-projects? My CGPA is 7.2 and I have one summer internship at a local manufacturer. What did your resume emphasize?",
    directed: false,
    reply: null,
    answered: false,
  },
  {
    title: "GD round at Deloitte — what actually gets you through?",
    body: "Deloitte's drive has a GD before HR. Seniors who cleared it: is it about talking the most, or something else? Any topics from your batch?",
    directed: true,
    reply:
      "Definitely not about talking the most — two loudest people in my group both got cut. Open with a structured framing ('three angles here: economic, social, tech'), yield to others by name, and summarize at the end. Our topic was 'AI and employment in India'.",
    answered: true,
  },
];

async function main() {
  const institution = await prisma.institution.findUniqueOrThrow({
    where: { slug: TENANT_SLUG },
  });
  const tenantId = institution.id;

  const already = await prisma.student.findFirst({
    where: { tenantId, mentorOptIn: true },
  });
  if (already) {
    console.log("seed-extra3 already applied — skipping.");
    return;
  }

  // Placed students with an accepted offer become the mentor pool.
  const placed = await prisma.student.findMany({
    where: { tenantId, placementStatus: "PLACED", deletedAt: null },
    include: {
      user: true,
      offers: {
        where: { status: "ACCEPTED" },
        orderBy: { ctcLpa: "desc" },
        take: 1,
        include: {
          application: {
            include: {
              drive: {
                include: { jobDescription: { include: { company: true } } },
              },
            },
          },
        },
      },
    },
    take: 40,
  });

  const withOffer = placed.filter((s) => s.offers.length > 0);
  const mentorPool = withOffer.slice(0, 8);
  for (const s of mentorPool) {
    const offer = s.offers[0];
    const company = offer.application?.drive.jobDescription.company?.name;
    const role = offer.application?.drive.jobDescription.title;
    const headline = company
      ? `${role ?? "Engineer"} @ ${company} — ask me how the pipeline actually went`
      : `Placed via PPO (₹${Number(offer.ctcLpa)}L) — happy to talk internship-to-offer conversion`;
    await prisma.student.update({
      where: { id: s.id },
      data: { mentorOptIn: true, mentorHeadline: headline },
    });
  }
  console.log(`Opted in ${mentorPool.length} placed students as mentors.`);

  // Unplaced students author the questions.
  const unplaced = await prisma.student.findMany({
    where: { tenantId, placementStatus: "UNPLACED", deletedAt: null },
    take: QUESTIONS.length,
  });

  let threads = 0;
  let replies = 0;
  for (let i = 0; i < QUESTIONS.length && i < unplaced.length; i++) {
    const q = QUESTIONS[i];
    const mentor = mentorPool[i % mentorPool.length];
    const createdAt = new Date(Date.now() - (10 - i * 2) * 24 * 60 * 60 * 1000);
    const thread = await prisma.mentorThread.create({
      data: {
        tenantId,
        authorStudentId: unplaced[i].id,
        mentorStudentId: q.directed ? mentor.id : null,
        title: q.title,
        body: q.body,
        status: q.answered ? "ANSWERED" : "OPEN",
        createdAt,
        updatedAt: createdAt,
      },
    });
    threads++;
    if (q.reply) {
      await prisma.mentorReply.create({
        data: {
          tenantId,
          threadId: thread.id,
          authorUserId: mentor.userId,
          body: q.reply,
          createdAt: new Date(createdAt.getTime() + 36 * 60 * 60 * 1000),
        },
      });
      replies++;
    }
  }
  console.log(`Created ${threads} threads and ${replies} replies.`);
  console.log("seed-extra3 complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
