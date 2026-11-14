import crypto from "node:crypto";

// Segredo de desenvolvimento: aceito SOMENTE fora de producao.
const DEV_ONLY_SECRET = "dev-secret-trocar-em-producao-hnk-ucl-2027";
const MIN_SECRET_LENGTH = 32;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_SECRET !== "true";
}

/**
 * Segredo HMAC usado para assinar URLs de midia e autenticar chamadas internas.
 * Em producao, ausente, curto ou igual ao valor de exemplo derruba a requisicao
 * em vez de rodar com um segredo publico no repositorio.
 */
export function getInternalSecret(): string {
  const secret = process.env.INTERNAL_SIGNING_SECRET?.trim() || "";
  if (secret && secret !== DEV_ONLY_SECRET && secret.length >= MIN_SECRET_LENGTH) {
    return secret;
  }
  if (isProduction()) {
    throw new Error(
      "INTERNAL_SIGNING_SECRET ausente ou fraco. Gere um com: openssl rand -base64 48"
    );
  }
  return secret || DEV_ONLY_SECRET;
}

/**
 * Segredo enviado ao n8n no header x-internal-secret. No n8n ele vive numa
 * credencial Header Auth do Webhook, nunca no JSON do workflow.
 * Retorna null quando nao configurado: o orquestrador pula o n8n.
 */
export function getN8nWebhookSecret(): string | null {
  const secret = process.env.N8N_WEBHOOK_SECRET?.trim() || "";
  if (secret.length >= MIN_SECRET_LENGTH) return secret;
  return null;
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
