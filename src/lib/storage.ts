import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { signMediaToken, verifyMediaToken } from "./security";

const STORAGE_ROOT = path.join(process.cwd(), ".data", "storage");

function resolveSafePath(storagePath: string): string {
  const cleaned = storagePath.replace(/^\/+/, "");
  if (
    !cleaned ||
    cleaned.includes("..") ||
    (!cleaned.startsWith("in/") && !cleaned.startsWith("out/"))
  ) {
    throw new Error("Invalid storage path");
  }
  return path.join(STORAGE_ROOT, cleaned);
}

export async function ensureStorageDirs(): Promise<void> {
  await fs.mkdir(path.join(STORAGE_ROOT, "in"), { recursive: true });
  await fs.mkdir(path.join(STORAGE_ROOT, "out"), { recursive: true });
}

function getBlobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token || null;
}

function normalizeBlobPath(storagePath: string): string {
  const clean = storagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean || clean.includes("..")) {
    throw new Error("Invalid storage path");
  }
  return clean;
}

export async function savePrivateObject(
  storagePath: string,
  data: Buffer
): Promise<void> {
  const blobToken = getBlobToken();
  if (blobToken) {
    const { put } = await import("@vercel/blob");
    await put(normalizeBlobPath(storagePath), data, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/jpeg",
      token: blobToken,
    });
    return;
  }
  await ensureStorageDirs();
  const abs = resolveSafePath(storagePath);
  await fs.writeFile(abs, data);
}

export async function readPrivateObject(
  storagePath: string
): Promise<Buffer | null> {
  const blobToken = getBlobToken();
  if (blobToken) {
    try {
      const { get } = await import("@vercel/blob");
      const res = await get(normalizeBlobPath(storagePath), {
        access: "private",
        useCache: false,
        token: blobToken,
      });
      if (!res || res.statusCode !== 200 || !res.stream) {
        return null;
      }
      const ab = await new Response(res.stream).arrayBuffer();
      return Buffer.from(ab);
    } catch {
      return null;
    }
  }
  try {
    const abs = resolveSafePath(storagePath);
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

export async function deletePrivateObject(storagePath: string): Promise<void> {
  const blobToken = getBlobToken();
  if (blobToken) {
    try {
      const { del } = await import("@vercel/blob");
      await del(normalizeBlobPath(storagePath), { token: blobToken });
    } catch {
      // Objeto ja removido ou ausente
    }
    return;
  }
  try {
    const abs = resolveSafePath(storagePath);
    await fs.unlink(abs);
  } catch {
    // Arquivo ja removido ou ausente
  }
}

export function buildSignedMediaUrl(
  action: "read" | "upload",
  storagePath: string,
  ttlMs = 15 * 60 * 1000
): string {
  const exp = Date.now() + ttlMs;
  const sig = signMediaToken(action, storagePath, exp);
  const endpoint = action === "upload" ? "/api/upload" : "/api/media";
  return `${endpoint}?path=${encodeURIComponent(storagePath)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;
}

export function validateSignedMediaParams(
  action: "read" | "upload",
  searchParams: URLSearchParams
): { ok: true; storagePath: string } | { ok: false } {
  const storagePath = searchParams.get("path") || "";
  const exp = Number(searchParams.get("exp") || "0");
  const sig = searchParams.get("sig") || "";
  if (!storagePath || !sig) return { ok: false };
  try {
    resolveSafePath(storagePath);
  } catch {
    return { ok: false };
  }
  if (!verifyMediaToken(action, storagePath, exp, sig)) {
    return { ok: false };
  }
  return { ok: true, storagePath };
}

export function newSelfieStoragePath(): { uploadId: string; selfiePath: string } {
  const uploadId = crypto.randomBytes(6).toString("base64url");
  return { uploadId, selfiePath: `in/${uploadId}.jpg` };
}
