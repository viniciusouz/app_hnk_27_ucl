import fs from "node:fs/promises";
import path from "node:path";
import { getN8nWebhookSecret } from "./security";

/**
 * Mirrors uploaded selfies and final composed artworks into DRIVE_OUTPUT_DIR
 * when configured on the local host, or forwards safely via the authenticated
 * n8n Cloud webhook (`action: "save_drive"`) when deployed in serverless cloud.
 */
export async function mirrorToDriveOutput(
  jobId: string,
  kind: "selfie" | "resultado",
  data: Buffer
): Promise<string | null> {
  const cleanJobId = jobId.trim();
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(cleanJobId)) {
    return null;
  }

  const fileName = `arquibancada_${cleanJobId}_${kind}.jpg`;
  const dir = process.env.DRIVE_OUTPUT_DIR?.trim();
  if (dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const targetPath = path.join(dir, fileName);
      await fs.writeFile(targetPath, data);
      return targetPath;
    } catch {
      return null;
    }
  }

  const n8nUrl = process.env.N8N_CLOUD_WEBHOOK_URL?.trim();
  const n8nSecret = getN8nWebhookSecret();
  if (!n8nUrl || !n8nSecret) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": n8nSecret,
      },
      body: JSON.stringify({
        action: "save_drive",
        jobId: cleanJobId,
        kind,
        fileName,
        imageBase64: data.toString("base64"),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as {
      ok?: boolean;
      driveFileId?: string | null;
    } | null;
    return payload?.ok && payload.driveFileId
      ? `gdrive:${payload.driveFileId}`
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
