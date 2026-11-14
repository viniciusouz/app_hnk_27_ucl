import fs from "node:fs/promises";
import path from "node:path";
import { CAMPAIGN_CONFIG } from "@/config/campaign.config";
import { deletePrivateObject } from "./storage";

export type JobStatus =
  | "queued"
  | "processing"
  | "done"
  | "done_fallback"
  | "error";

export type JobErrorCode =
  | "no_face"
  | "multiple_faces"
  | "model_refused"
  | "timeout"
  | null;

export interface ArquibancadaJob {
  id: string;
  status: JobStatus;
  names: [string, string, string];
  userName: string | null;
  inviterFromId: string | null;
  selfiePath: string;
  imagePath: string | null;
  errorCode: JobErrorCode;
  durationMs: number | null;
  deviceHash: string | null;
  createdAt: string;
  expiresAt: string;
}

const DATA_ROOT = path.join(process.cwd(), ".data");
const JOBS_DIR = path.join(DATA_ROOT, "jobs");
const LOGS_DIR = path.join(DATA_ROOT, "logs");

async function ensureDirs(): Promise<void> {
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

function jobFilePath(id: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId || safeId !== id) {
    throw new Error("Invalid job id");
  }
  return path.join(JOBS_DIR, `${safeId}.json`);
}

export async function createJobRecord(
  job: ArquibancadaJob
): Promise<ArquibancadaJob> {
  await ensureDirs();
  await fs.writeFile(jobFilePath(job.id), JSON.stringify(job, null, 2), "utf8");
  return job;
}

export async function getJobRecord(
  id: string
): Promise<ArquibancadaJob | null> {
  try {
    const raw = await fs.readFile(jobFilePath(id), "utf8");
    const parsed = JSON.parse(raw) as ArquibancadaJob;
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      await expireSingleJob(parsed);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function isJobExpired(id: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(jobFilePath(id), "utf8");
    const parsed = JSON.parse(raw) as ArquibancadaJob;
    return Date.parse(parsed.expiresAt) <= Date.now();
  } catch {
    return false;
  }
}

export async function updateJobRecord(
  id: string,
  patch: Partial<ArquibancadaJob>
): Promise<ArquibancadaJob | null> {
  const current = await getJobRecord(id);
  if (!current) return null;
  const updated: ArquibancadaJob = {
    ...current,
    ...patch,
    id: current.id,
  };
  await fs.writeFile(jobFilePath(id), JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

async function expireSingleJob(job: ArquibancadaJob): Promise<void> {
  await deletePrivateObject(job.selfiePath);
  if (job.imagePath) {
    await deletePrivateObject(job.imagePath);
  }
  try {
    await fs.unlink(jobFilePath(job.id));
  } catch {
    // Registro ja removido
  }
}

export async function deleteJobRecord(id: string): Promise<void> {
  try {
    const raw = await fs.readFile(jobFilePath(id), "utf8");
    const job = JSON.parse(raw) as ArquibancadaJob;
    await expireSingleJob(job);
  } catch {
    // Registro ausente
  }
}

export async function cleanupExpiredJobs(): Promise<{
  removedCount: number;
}> {
  await ensureDirs();
  let removedCount = 0;
  const files = await fs.readdir(JOBS_DIR).catch(() => []);
  const now = Date.now();

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const full = path.join(JOBS_DIR, file);
    try {
      const raw = await fs.readFile(full, "utf8");
      const job = JSON.parse(raw) as ArquibancadaJob;
      if (Date.parse(job.expiresAt) <= now) {
        await expireSingleJob(job);
        removedCount++;
      }
    } catch {
      // Ignora arquivo corrompido
    }
  }
  return { removedCount };
}

export async function checkAndConsumeRateLimit(
  deviceHash: string
): Promise<{ allowed: boolean; reason?: "device" | "global" }> {
  if (process.env.BYPASS_RATE_LIMIT_LOCAL === "true") {
    return { allowed: true };
  }

  await ensureDirs();
  const dayKey = new Date().toISOString().slice(0, 10);
  const files = await fs.readdir(JOBS_DIR).catch(() => []);

  let globalToday = 0;
  let deviceToday = 0;

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(JOBS_DIR, file), "utf8");
      const job = JSON.parse(raw) as ArquibancadaJob;
      if (job.createdAt.startsWith(dayKey)) {
        globalToday++;
        if (job.deviceHash && job.deviceHash === deviceHash) {
          deviceToday++;
        }
      }
    } catch {
      // Ignora entrada invalida
    }
  }

  if (globalToday >= CAMPAIGN_CONFIG.limits.maxGlobalPerDay) {
    return { allowed: false, reason: "global" };
  }
  if (deviceToday >= CAMPAIGN_CONFIG.limits.maxPerDevicePerDay) {
    return { allowed: false, reason: "device" };
  }
  return { allowed: true };
}

export async function appendAnonymousLog(entry: {
  event: string;
  jobId?: string;
  status?: string;
  durationMs?: number | null;
  errorCode?: string | null;
  meta?: Record<string, string | number | boolean>;
}): Promise<void> {
  try {
    await ensureDirs();
    const dayKey = new Date().toISOString().slice(0, 10);
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...entry,
    });
    await fs.appendFile(
      path.join(LOGS_DIR, `events-${dayKey}.jsonl`),
      line + "\n",
      "utf8"
    );
  } catch {
    // Log nao bloqueia o fluxo
  }
}
