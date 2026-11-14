import fs from "node:fs/promises";
import path from "node:path";

/**
 * Mirrors uploaded selfies and final composed artworks into DRIVE_OUTPUT_DIR
 * when configured on the host machine, never failing the main pipeline if
 * running inside a cloud/read-only container.
 */
export async function mirrorToDriveOutput(
  jobId: string,
  kind: "selfie" | "resultado",
  data: Buffer
): Promise<string | null> {
  const dir = process.env.DRIVE_OUTPUT_DIR?.trim();
  if (!dir) return null;

  const cleanJobId = jobId.trim();
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(cleanJobId)) {
    return null;
  }

  try {
    await fs.mkdir(dir, { recursive: true });
    const targetPath = path.join(dir, `arquibancada_${cleanJobId}_${kind}.jpg`);
    await fs.writeFile(targetPath, data);
    return targetPath;
  } catch {
    return null;
  }
}
