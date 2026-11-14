import fs from "node:fs/promises";
import os from "node:os";
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

const DATA_ROOT = process.env.VERCEL
  ? path.join(os.tmpdir(), "arquibancada-data")
  : path.join(process.cwd(), ".data");
const JOBS_DIR = path.join(DATA_ROOT, "jobs");
const LOGS_DIR = path.join(DATA_ROOT, "logs");

function getBlobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token || null;
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

function validateJobId(id: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId || safeId !== id) {
    throw new Error("Invalid job id");
  }
  return safeId;
}

function jobFilePath(id: string): string {
  return path.join(JOBS_DIR, `${validateJobId(id)}.json`);
}

function jobBlobPath(id: string): string {
  return `jobs/${validateJobId(id)}.json`;
}

function rateLimitPrefix(dayKey: string, deviceHash?: string): string {
  if (!deviceHash) {
    return `ratelimit/${dayKey}/`;
  }
  const safeHash =
    deviceHash.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "anon";
  return `ratelimit/${dayKey}/${safeHash}/`;
}

async function readBlobJobRaw(
  pathname: string,
  blobToken: string
): Promise<ArquibancadaJob | null> {
  try {
    const { get } = await import("@vercel/blob");
    const res = await get(pathname, {
      access: "private",
      useCache: false,
      token: blobToken,
    });
    if (!res || res.statusCode !== 200 || !res.stream) {
      return null;
    }
    const raw = await new Response(res.stream).text();
    return JSON.parse(raw) as ArquibancadaJob;
  } catch {
    return null;
  }
}

async function writeBlobJob(
  job: ArquibancadaJob,
  blobToken: string
): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(jobBlobPath(job.id), JSON.stringify(job, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: blobToken,
  });
}

async function listAllBlobs(prefix: string, blobToken: string) {
  const { list } = await import("@vercel/blob");
  const all: Array<{ pathname: string; uploadedAt: Date }> = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000, token: blobToken });
    for (const b of page.blobs) {
      all.push({ pathname: b.pathname, uploadedAt: b.uploadedAt });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return all;
}

async function countBlobsUpTo(
  prefix: string,
  cap: number,
  blobToken: string
): Promise<number> {
  const { list } = await import("@vercel/blob");
  let count = 0;
  let cursor: string | undefined;
  do {
    const page = await list({
      prefix,
      cursor,
      limit: Math.min(1000, Math.max(10, cap)),
      token: blobToken,
    });
    count += page.blobs.length;
    if (count >= cap) return count;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return count;
}

async function deleteBlobBatches(
  pathnames: string[],
  blobToken: string
): Promise<void> {
  if (pathnames.length === 0) return;
  const { del } = await import("@vercel/blob");
  for (let i = 0; i < pathnames.length; i += 100) {
    const batch = pathnames.slice(i, i + 100);
    await del(batch, { token: blobToken }).catch(() => undefined);
  }
}

export async function createJobRecord(
  job: ArquibancadaJob
): Promise<ArquibancadaJob> {
  const blobToken = getBlobToken();
  if (blobToken) {
    const { put } = await import("@vercel/blob");
    const dayKey = (job.createdAt || new Date().toISOString()).slice(0, 10);
    const markerPath = `${rateLimitPrefix(dayKey, job.deviceHash || "anon")}${validateJobId(job.id)}.txt`;
    await Promise.all([
      writeBlobJob(job, blobToken),
      put(markerPath, "1", {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "text/plain",
        token: blobToken,
      }),
    ]);
    return job;
  }

  await ensureDirs();
  await fs.writeFile(jobFilePath(job.id), JSON.stringify(job, null, 2), "utf8");
  return job;
}

export async function getJobRecord(
  id: string
): Promise<ArquibancadaJob | null> {
  const blobToken = getBlobToken();
  if (blobToken) {
    let pathname: string;
    try {
      pathname = jobBlobPath(id);
    } catch {
      return null;
    }
    const parsed = await readBlobJobRaw(pathname, blobToken);
    if (!parsed) return null;
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      await expireSingleJob(parsed);
      return null;
    }
    return parsed;
  }

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
  const blobToken = getBlobToken();
  if (blobToken) {
    try {
      const parsed = await readBlobJobRaw(jobBlobPath(id), blobToken);
      if (!parsed) return false;
      return Date.parse(parsed.expiresAt) <= Date.now();
    } catch {
      return false;
    }
  }

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
  const blobToken = getBlobToken();
  if (blobToken) {
    await writeBlobJob(updated, blobToken);
    return updated;
  }
  await fs.writeFile(jobFilePath(id), JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

async function expireSingleJob(job: ArquibancadaJob): Promise<void> {
  await deletePrivateObject(job.selfiePath);
  if (job.imagePath) {
    await deletePrivateObject(job.imagePath);
  }
  const blobToken = getBlobToken();
  if (blobToken) {
    try {
      const { del } = await import("@vercel/blob");
      await del(jobBlobPath(job.id), { token: blobToken });
    } catch {
      // Registro ja removido
    }
    return;
  }
  try {
    await fs.unlink(jobFilePath(job.id));
  } catch {
    // Registro ja removido
  }
}

export async function deleteJobRecord(id: string): Promise<void> {
  const blobToken = getBlobToken();
  if (blobToken) {
    try {
      const job = await readBlobJobRaw(jobBlobPath(id), blobToken);
      if (job) await expireSingleJob(job);
    } catch {
      // Registro ausente
    }
    return;
  }

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
  const blobToken = getBlobToken();
  if (blobToken) {
    const now = Date.now();
    const ttlMs = CAMPAIGN_CONFIG.limits.jobTtlHours * 60 * 60 * 1000;
    const todayUtc = new Date(now).toISOString().slice(0, 10);
    let removedCount = 0;
    const expiredMedia = new Set<string>();

    const jobBlobs = await listAllBlobs("jobs/", blobToken);
    for (let i = 0; i < jobBlobs.length; i += 10) {
      const chunk = jobBlobs.slice(i, i + 10);
      await Promise.all(
        chunk.map(async (b) => {
          const job = await readBlobJobRaw(b.pathname, blobToken);
          if (job && Date.parse(job.expiresAt) <= now) {
            expiredMedia.add(job.selfiePath);
            if (job.imagePath) expiredMedia.add(job.imagePath);
            await expireSingleJob(job);
            removedCount++;
          } else if (!job && now - b.uploadedAt.getTime() >= ttlMs) {
            await deleteBlobBatches([b.pathname], blobToken);
            removedCount++;
          }
        })
      );
    }

    const [inBlobs, outBlobs, rateBlobs] = await Promise.all([
      listAllBlobs("in/", blobToken),
      listAllBlobs("out/", blobToken),
      listAllBlobs("ratelimit/", blobToken),
    ]);

    const orphanIn = inBlobs
      .filter(
        (b) =>
          !expiredMedia.has(b.pathname) &&
          now - b.uploadedAt.getTime() >= ttlMs
      )
      .map((b) => b.pathname);
    const orphanOut = outBlobs
      .filter(
        (b) =>
          !expiredMedia.has(b.pathname) &&
          now - b.uploadedAt.getTime() >= ttlMs
      )
      .map((b) => b.pathname);
    const staleRate = rateBlobs
      .filter((b) => {
        const m = /^ratelimit\/(\d{4}-\d{2}-\d{2})\//.exec(b.pathname);
        return Boolean(m && m[1] < todayUtc);
      })
      .map((b) => b.pathname);

    removedCount += orphanIn.length;
    await deleteBlobBatches(
      [...orphanIn, ...orphanOut, ...staleRate],
      blobToken
    );

    return { removedCount };
  }

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

  const blobToken = getBlobToken();
  const dayKey = new Date().toISOString().slice(0, 10);

  if (blobToken) {
    const [globalToday, deviceToday] = await Promise.all([
      countBlobsUpTo(
        rateLimitPrefix(dayKey),
        CAMPAIGN_CONFIG.limits.maxGlobalPerDay,
        blobToken
      ),
      countBlobsUpTo(
        rateLimitPrefix(dayKey, deviceHash),
        CAMPAIGN_CONFIG.limits.maxPerDevicePerDay,
        blobToken
      ),
    ]);
    if (globalToday >= CAMPAIGN_CONFIG.limits.maxGlobalPerDay) {
      return { allowed: false, reason: "global" };
    }
    if (deviceToday >= CAMPAIGN_CONFIG.limits.maxPerDevicePerDay) {
      return { allowed: false, reason: "device" };
    }
    return { allowed: true };
  }

  await ensureDirs();
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
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });

  if (getBlobToken() || process.env.VERCEL === "1") {
    console.info(line);
    return;
  }

  try {
    await ensureDirs();
    const dayKey = new Date().toISOString().slice(0, 10);
    await fs.appendFile(
      path.join(LOGS_DIR, `events-${dayKey}.jsonl`),
      line + "\n",
      "utf8"
    );
  } catch {
    // Log nao bloqueia o fluxo
  }
}
