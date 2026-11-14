import crypto from "node:crypto";

const FALLBACK_DEV_SECRET = "dev-secret-trocar-em-producao-hnk-ucl-2027";

export function getInternalSecret(): string {
  return process.env.INTERNAL_SIGNING_SECRET || FALLBACK_DEV_SECRET;
}

export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generateJobId(): string {
  // 8 caracteres nao sequenciais URL-safe (~48 bits de entropia)
  return crypto.randomBytes(6).toString("base64url");
}

export function signMediaToken(
  action: "read" | "upload",
  storagePath: string,
  expiresAtMs: number
): string {
  const payload = `${action}:${storagePath}:${expiresAtMs}`;
  return crypto
    .createHmac("sha256", getInternalSecret())
    .update(payload)
    .digest("base64url");
}

export function verifyMediaToken(
  action: "read" | "upload",
  storagePath: string,
  expiresAtMs: number,
  signature: string
): boolean {
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
    return false;
  }
  const expected = signMediaToken(action, storagePath, expiresAtMs);
  return timingSafeCompare(signature, expected);
}

export function hashDeviceId(deviceId: string): string {
  return crypto
    .createHmac("sha256", getInternalSecret())
    .update(deviceId)
    .digest("hex")
    .slice(0, 24);
}
