import "dotenv/config";
import IORedis from "ioredis";
import { Queue, Worker } from "bullmq";

/**
 * Spike, not a feature test: validates bullmq@5.79.2's `deduplication` job
 * option against the actual installed version and a real Redis instance
 * before summary-recompute.queue.ts is built on top of it (per the master
 * plan's explicit call-out that BullMQ debounce/dedup semantics need
 * verification against the installed version, not assumed from docs).
 *
 * The mechanism: adding a job with `deduplication: { id, ttl }` while a job
 * with the same id is still waiting/delayed is a no-op — the duplicate is
 * dropped, not queued, and the ttl is NOT reset unless `extend: true`. This
 * is what turns a burst of N domain events into exactly 1 recompute job.
 */
describe("BullMQ deduplication spike", () => {
  const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
  });
  const queueName = `spike-dedup-${Date.now()}`;
  const queue = new Queue(queueName, { connection });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await queue.close();
    await connection.quit();
  });

  it("collapses N rapid adds with the same dedup id into a single queued job", async () => {
    const dedupId = "tenant-a:batch-1";
    for (let i = 0; i < 5; i += 1) {
      await queue.add(
        "recompute",
        { attempt: i },
        { delay: 1000, deduplication: { id: dedupId, ttl: 5000 } },
      );
    }

    const counts = await queue.getJobCounts("waiting", "delayed");
    expect((counts.waiting ?? 0) + (counts.delayed ?? 0)).toBe(1);

    const jobs = await queue.getJobs(["waiting", "delayed"]);
    expect(jobs).toHaveLength(1);
    // The FIRST add wins — later duplicates are dropped, not merged.
    expect(jobs[0]?.data).toEqual({ attempt: 0 });
  });

  it("allows a new job once the previous dedup id's job has completed", async () => {
    const dedupId = "tenant-a:batch-2";
    const processed: unknown[] = [];
    const worker = new Worker(
      queueName,
      async (job) => {
        processed.push(job.data);
      },
      { connection },
    );
    await worker.waitUntilReady();

    await queue.add(
      "recompute",
      { attempt: 0 },
      { deduplication: { id: dedupId } },
    );
    await new Promise((resolve) => worker.on("completed", resolve));

    await queue.add(
      "recompute",
      { attempt: 1 },
      { deduplication: { id: dedupId } },
    );
    await new Promise((resolve) => worker.on("completed", resolve));

    expect(processed).toEqual([{ attempt: 0 }, { attempt: 1 }]);
    await worker.close();
  });
});
