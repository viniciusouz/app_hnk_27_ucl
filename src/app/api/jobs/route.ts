import { NextRequest, NextResponse } from "next/server";
import { CAMPAIGN_CONFIG } from "@/config/campaign.config";
import { UX_COPY } from "@/config/copy.config";
import {
  attachDeviceCookie,
  getRequestBaseUrl,
  resolveDeviceHash,
} from "@/lib/http";
import {
  appendAnonymousLog,
  checkAndConsumeRateLimit,
  cleanupExpiredJobs,
  createJobRecord,
} from "@/lib/jobStore";
import { triggerJobProcessing } from "@/lib/orchestrator";
import { generateJobId } from "@/lib/security";
import { readPrivateObject } from "@/lib/storage";
import { validatePersonName } from "@/lib/validation";

// O processamento roda via after() nesta mesma funcao: IA + composicao + Plano B
// cabem com folga em 300s (limite do Fluid Compute na Vercel).
export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as {
    selfiePath?: unknown;
    names?: unknown;
    consent?: unknown;
    inviterFromId?: unknown;
  } | null;

  if (!body || body.consent !== true) {
    return NextResponse.json(
      { error: UX_COPY.errors.consentMissing, code: "consent_required" },
      { status: 400 }
    );
  }

  const selfiePath =
    typeof body.selfiePath === "string" ? body.selfiePath.trim() : "";
  if (!/^in\/[a-zA-Z0-9_-]+\.jpg$/.test(selfiePath)) {
    return NextResponse.json(
      { error: "Envie sua foto antes de continuar.", code: "invalid_selfie" },
      { status: 400 }
    );
  }

  const selfieExists = await readPrivateObject(selfiePath);
  if (!selfieExists) {
    return NextResponse.json(
      {
        error: "Sua foto expirou ou não foi encontrada. Envie novamente.",
        code: "selfie_not_found",
      },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.names) || body.names.length !== 3) {
    return NextResponse.json(
      { error: "Informe os 3 nomes de amigos.", code: "invalid_names" },
      { status: 400 }
    );
  }

  const fieldErrors: Array<string | null> = [null, null, null];
  const cleanedNames: [string, string, string] = ["", "", ""];
  let firstErrorMessage: string | null = null;
  let firstErrorCode: string | null = null;

  for (let i = 0; i < 3; i++) {
    const raw = typeof body.names[i] === "string" ? body.names[i] : "";
    const result = validatePersonName(raw, i + 1);
    if (!result.valid) {
      const msg = result.message || UX_COPY.errors.blockedName;
      fieldErrors[i] = msg;
      if (!firstErrorMessage) {
        firstErrorMessage = msg;
        firstErrorCode = result.code || "invalid_name";
      }
    } else {
      cleanedNames[i] = result.cleaned;
    }
  }

  if (firstErrorMessage) {
    return NextResponse.json(
      {
        error: firstErrorMessage,
        code: firstErrorCode,
        fieldErrors,
      },
      { status: 400 }
    );
  }

  const { deviceId, deviceHash, isNewCookie } = resolveDeviceHash(req);
  const rate = await checkAndConsumeRateLimit(deviceHash);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: UX_COPY.errors.rateLimited, code: "rate_limited" },
      { status: 429 }
    );
  }

  // Varredura oportunista de pedidos expirados (> 24h)
  void cleanupExpiredJobs().catch(() => undefined);

  const now = Date.now();
  const expiresAt = new Date(
    now + CAMPAIGN_CONFIG.limits.jobTtlHours * 60 * 60 * 1000
  ).toISOString();

  const inviterFromId =
    typeof body.inviterFromId === "string" &&
    /^[a-zA-Z0-9_-]{4,24}$/.test(body.inviterFromId)
      ? body.inviterFromId
      : null;

  const job = await createJobRecord({
    id: generateJobId(),
    status: "queued",
    names: cleanedNames,
    userName: null,
    inviterFromId,
    selfiePath,
    imagePath: null,
    errorCode: null,
    durationMs: null,
    deviceHash,
    createdAt: new Date(now).toISOString(),
    expiresAt,
  });

  await appendAnonymousLog({
    event: "job_created",
    jobId: job.id,
    status: "queued",
    meta: { hasInviter: Boolean(inviterFromId) },
  });

  triggerJobProcessing(job.id, getRequestBaseUrl(req));

  const res = NextResponse.json(
    {
      id: job.id,
      status: job.status,
      names: job.names,
      expiresAt: job.expiresAt,
    },
    { status: 201 }
  );

  if (isNewCookie) {
    attachDeviceCookie(res, deviceId);
  }
  return res;
}
