import { Queue } from "bullmq";
import IORedis from "ioredis";

export type FindMaidsJob =
  | { type: "lead.summary"; enquiryId: string }
  | { type: "agency.embed"; agencyId: string }
  | { type: "knowledge.embed"; documentId: string }
  | { type: "lead.reply-draft"; enquiryId: string };

let connection: IORedis | null = null;
let queue: Queue<FindMaidsJob> | null = null;

function getQueue() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!connection)
    connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  if (!queue) queue = new Queue<FindMaidsJob>("findmaids-ai", { connection });
  return queue;
}

export async function enqueueJob(job: FindMaidsJob) {
  const target = getQueue();
  if (!target) return false;
  await target.add(job.type, job, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  });
  return true;
}

export function createJobConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required to start the job worker.");
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
