import type { RoundType } from "@pms/types";

/** Curated, India-relevant prep material per round type. Static by design —
 * these are editorial picks, not user data; swap for a DB table when
 * institutes want to curate their own. */

export interface PrepResource {
  title: string;
  url: string;
  note: string;
}

export const PREP_PACKS: Record<RoundType, { label: string; resources: PrepResource[] }> = {
  APTITUDE: {
    label: "Aptitude",
    resources: [
      { title: "IndiaBix — Quantitative Aptitude", url: "https://www.indiabix.com/aptitude/questions-and-answers/", note: "The classic bank: percentages, ratios, time-speed-distance." },
      { title: "PrepInsta — Company-wise aptitude papers", url: "https://prepinsta.com/", note: "Patterns for TCS NQT, Infosys, Wipro, Cognizant tests." },
      { title: "RS Aggarwal practice sets", url: "https://www.freshersnow.com/rs-aggarwal-quantitative-aptitude/", note: "Structured chapter-wise drilling." },
    ],
  },
  CODING: {
    label: "Coding",
    resources: [
      { title: "Striver's SDE Sheet", url: "https://takeuforward.org/interviews/strivers-sde-sheet-top-coding-interview-problems/", note: "The 191-problem list most Indian campus offers are cracked with." },
      { title: "NeetCode 150", url: "https://neetcode.io/practice", note: "Pattern-first DSA — best explanations per topic." },
      { title: "LeetCode Top Interview 150", url: "https://leetcode.com/studyplan/top-interview-150/", note: "Company-tagged practice; do easies fast, mediums thoroughly." },
    ],
  },
  GD: {
    label: "Group Discussion",
    resources: [
      { title: "GD topics with model answers", url: "https://www.indiabix.com/group-discussion/topics-with-answers/", note: "Current-affairs and abstract topics, both sides argued." },
      { title: "GD do's and don'ts", url: "https://prepinsta.com/group-discussion/", note: "Structure: open strong, yield gracefully, summarize." },
    ],
  },
  TECHNICAL: {
    label: "Technical interview",
    resources: [
      { title: "GFG Last-minute notes — OS, DBMS, CN", url: "https://www.geeksforgeeks.org/lmns/", note: "Core CS one-pagers — the four subjects every panel probes." },
      { title: "InterviewBit technical questions", url: "https://www.interviewbit.com/technical-interview-questions/", note: "Language + CS fundamentals, asked-in-company tagged." },
      { title: "System Design Primer (advanced)", url: "https://github.com/donnemartin/system-design-primer", note: "For Dream-slab product companies; basics are enough on campus." },
    ],
  },
  HR: {
    label: "HR interview",
    resources: [
      { title: "'Tell me about yourself' framework", url: "https://www.indiabix.com/hr-interview/questions-and-answers/", note: "Present → past → future, 90 seconds, end on the role." },
      { title: "50 common HR questions", url: "https://prepinsta.com/interview-preparation/hr-interview-questions/", note: "Strengths/weaknesses, relocation, bond questions — prepare, don't improvise." },
    ],
  },
  OFFER: {
    label: "Offer stage",
    resources: [
      { title: "Reading an Indian offer letter", url: "https://www.naukri.com/blog/how-to-evaluate-a-job-offer/", note: "Fixed vs variable vs joining bonus — know your real in-hand." },
    ],
  },
};
