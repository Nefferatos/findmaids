import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  assertStagingWriteAllowed,
  loadEnvFile,
  StagingGuardError,
} from "../lib/security/staging-guard";

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error("Usage: tsx scripts/staging-run.ts <command> [args]");
  process.exit(2);
}

try {
  const env: Record<string, string | undefined> = { ...process.env };
  loadEnvFile(path.join(process.cwd(), ".env.staging"), env);
  assertStagingWriteAllowed(env);
  const result = spawnSync(command.join(" "), {
    stdio: "inherit",
    shell: true,
    env: env as NodeJS.ProcessEnv,
  });
  process.exit(result.status ?? 1);
} catch (error) {
  console.error(
    error instanceof StagingGuardError ? error.message : "Staging run failed.",
  );
  process.exit(1);
}
