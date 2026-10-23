# Background Jobs

FindMaids uses BullMQ and Redis for lead summaries, reply drafts, and embeddings. Jobs are best-effort enqueued after lead creation; when `REDIS_URL` is absent, enqueue returns false and no background work is performed. Configure Redis before enabling these features beyond a local demo.

## Local operation

1. Start Redis with `docker compose up -d redis`.
2. Set `REDIS_URL=redis://localhost:6379` in the server environment.
3. Start the worker in a separate process with `npm run jobs:worker`.
4. Start the web app normally with `npm run dev`.

The queue is named `findmaids-ai`. It retries up to three times with exponential backoff and retains a bounded set of completed/failed jobs. The worker handles `lead.summary`, `lead.reply-draft`, and `agency.embed`. `knowledge.embed` is reserved for document ingestion.

Redis is optional for basic directory, chat FAQ, and draft UI operations. Do not run multiple workers with the same deployment secret store but different databases. Monitor failed jobs and Redis memory/availability before production use.
