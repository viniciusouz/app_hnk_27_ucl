import fs from "node:fs/promises";
import path from "node:path";
import { after } from "next/server";
import sharp from "sharp";
import { CAMPAIGN_CONFIG } from "@/config/campaign.config";
import {
  composeArquibancadaImage,
  validateAiSeat1Placement,
} from "./composer";
import { mirrorToDriveOutput } from "./driveSync";
import {
  type ArquibancadaJob,
  appendAnonymousLog,
  getJobRecord,
  updateJobRecord,
} from "./jobStore";
import { getInternalSecret, getN8nWebhookSecret } from "./security";
import {
  buildSignedMediaUrl,
  readPrivateObject,
  savePrivateObject,
} from "./storage";

const PROMPT_B_COMPOSE = `EDIT: In Image 1, there are four empty glossy green stadium seats in the front row between two red edge seats. Seat one adult person ONLY in Seat 1 on the far left (the green seat immediately next to the red seat on the left border, directly in front of the cheering man in the plain white t-shirt, centered at x=17% and strictly within x=5% to x=26%). Seats 2, 3 and 4 to the right MUST stay 100% empty, uncovered and untouched.
SOURCE: Image 2 supplies the foreground person's exact identity only; ignore its background, other people, original clothing, lighting and framing. Image 3 supplies the green football shirt only; ignore its white background.
IDENTITY LOCK: Treat Image 2 as strict biometric identity evidence, not inspiration. Preserve exact gender presentation, skin tone, facial proportions, eye shape and spacing, nose, mouth, jawline, facial hair if present, hairline, full hair length, curl pattern and hair volume, apparent age and natural skin texture, with matching neck and arm skin tone. Do not beautify, lighten or darken skin tone, alter hair texture, or substitute a similar person.
SCALE AND POSE LOCK: Match the exact head and shoulder scale of the fans standing immediately behind the green seats so the person fits compactly inside Seat 1 alone (never oversized across two seats). Seated upright facing the camera inside Seat 1, both knees and thighs kept together strictly within Seat 1, the person's right fist (on the viewer's far left, near the left border) raised in celebration, and the person's left arm tucked close to their own torso with the left hand resting on their own left thigh inside x<=25% so no elbow, forearm or shirt crosses into Seat 2 (in front of the striped red-and-black shirt). Plain dark trousers, warm authentic open smile.
PRODUCT LOCK: Reproduce the green football shirt from Image 3 with its exact dark green color, vertical white lettering, starball and shield crests, and red-and-white collar and sleeve trims fitted naturally. Do not redesign or invent text.
PRESERVE: Camera, crop, Brazilian crowd in European club shirts behind, lighting and colors of Image 1. Seats 2, 3 and 4 on the right keep their clean glossy green backrests and red stars completely visible and unobstructed.
INTEGRATE: Match the cool stadium floodlight from the upper front left with realistic contact shadows on Seat 1 and natural highlights on hair, skin and jersey.
AVOID: Never place the person in Seat 2, 3 or 4. Never spread knees or elbows into Seat 2. No text or names added to any seat. No second person from Image 2. Nothing held in the hands.`;

const PROMPT_B_RETRY_PREFIX =
  "CRITICAL CORRECTION: Seat the person ONLY in the 1st leftmost green chair right next to the left-edge red seat, directly in front of the white t-shirt fan. Keep the 2nd, 3rd and 4th green chairs 100% empty. ";

const activeWatchdogs = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runFallbackPipeline(
  jobId: string,
  reason: string
): Promise<void> {
  const startedAt = Date.now();
  const job = await getJobRecord(jobId);
  if (!job) return;

  const fallbackBuffer = await composeArquibancadaImage({
    mode: "fallback",
    names: job.names,
    userName: job.userName,
  });

  const outPath = `out/${job.id}.jpg`;
  await savePrivateObject(outPath, fallbackBuffer);
  await mirrorToDriveOutput(job.id, "resultado", fallbackBuffer);

  const durationMs = Date.now() - startedAt;
  await updateJobRecord(job.id, {
    status: "done_fallback",
    imagePath: outPath,
    errorCode: reason === "timeout" ? "timeout" : job.errorCode,
    durationMs,
  });

  await appendAnonymousLog({
    event: "job_fallback",
    jobId: job.id,
    status: "done_fallback",
    durationMs,
    meta: { reason },
  });
}

async function completeAiJob(
  job: ArquibancadaJob,
  aiImageBuffer: Buffer,
  startedAt: number,
  meta?: Record<string, string | number | boolean>
): Promise<void> {
  const composed = await composeArquibancadaImage({
    mode: "ai",
    baseImageBuffer: aiImageBuffer,
    names: job.names,
    userName: job.userName,
  });
  const outPath = `out/${job.id}.jpg`;
  await savePrivateObject(outPath, composed);
  await mirrorToDriveOutput(job.id, "resultado", composed);
  const durationMs = Date.now() - startedAt;
  await updateJobRecord(job.id, {
    status: "done",
    imagePath: outPath,
    errorCode: null,
    durationMs,
  });
  await appendAnonymousLog({
    event: "job_done",
    jobId: job.id,
    status: "done",
    durationMs,
    meta,
  });
}

async function markModelRefusedJob(
  jobId: string,
  startedAt: number,
  meta?: Record<string, string | number | boolean>
): Promise<void> {
  await updateJobRecord(jobId, {
    status: "error",
    errorCode: "model_refused",
    durationMs: Date.now() - startedAt,
  });
  await appendAnonymousLog({
    event: "job_error",
    jobId,
    status: "error",
    errorCode: "model_refused",
    meta,
  });
}

async function callNanoBananaOnce(
  masterB64: string,
  selfieB64: string,
  shirtB64: string,
  timeoutMs: number,
  promptPrefix = ""
): Promise<
  | { ok: true; imageBuffer: Buffer }
  | { ok: false; kind: "model_refused" | "timeout" | "upstream_error"; detail: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, kind: "upstream_error", detail: "Missing GEMINI_API_KEY" };
  }

  const model = process.env.NANO_BANANA_MODEL || "gemini-nano-banana-2.1";
  // Chave vai no header: query string acaba em logs de proxy e de observabilidade
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: `${promptPrefix}${PROMPT_B_COMPOSE}` },
              { inline_data: { mime_type: "image/jpeg", data: masterB64 } },
              { inline_data: { mime_type: "image/jpeg", data: selfieB64 } },
              { inline_data: { mime_type: "image/png", data: shirtB64 } },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: "4:5",
            imageSize: "1K",
          },
          thinkingConfig: {
            thinkingLevel: "HIGH",
          },
        },
      }),
    });

    const json = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!res.ok) {
      const errMsg = JSON.stringify(json || { status: res.status });
      if (res.status === 400 || errMsg.toLowerCase().includes("safety")) {
        return { ok: false, kind: "model_refused", detail: errMsg };
      }
      return { ok: false, kind: "upstream_error", detail: errMsg };
    }

    const candidates = (json?.candidates as Array<Record<string, unknown>>) || [];
    const firstCandidate = candidates[0];
    const finishReason = String(firstCandidate?.finishReason || "");
    if (
      finishReason === "SAFETY" ||
      finishReason === "IMAGE_SAFETY" ||
      finishReason === "PROHIBITED_CONTENT"
    ) {
      return { ok: false, kind: "model_refused", detail: finishReason };
    }

    const content = firstCandidate?.content as Record<string, unknown> | undefined;
    const parts = (content?.parts as Array<Record<string, unknown>>) || [];
    for (const part of parts) {
      const inlineData = (part.inline_data || part.inlineData) as
        | { data?: string; mimeType?: string; mime_type?: string }
        | undefined;
      if (inlineData?.data) {
        return {
          ok: true,
          imageBuffer: Buffer.from(inlineData.data, "base64"),
        };
      }
    }

    return {
      ok: false,
      kind: "upstream_error",
      detail: "No image returned by Nano Banana",
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, kind: "timeout", detail: "Timeout exceeded" };
    }
    return {
      ok: false,
      kind: "upstream_error",
      detail: err instanceof Error ? err.message : "Fetch error",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runN8nCloudSync(
  job: ArquibancadaJob,
  n8nUrl: string,
  selfieBuf: Buffer,
  startedAt: number,
  webhookSecret: string
): Promise<boolean> {
  const [masterBuf, shirtRawBuf] = await Promise.all([
    fs.readFile(path.resolve(CAMPAIGN_CONFIG.assets.masterImage)),
    fs.readFile(path.resolve(CAMPAIGN_CONFIG.assets.jerseyImage)),
  ]);
  const shirtBuf = await sharp(shirtRawBuf)
    .resize({ width: 1024, withoutEnlargement: true })
    .png({ compressionLevel: 8 })
    .toBuffer();

  const masterBase64 = masterBuf.toString("base64");
  const selfieBase64 = selfieBuf.toString("base64");
  const jerseyBase64 = shirtBuf.toString("base64");

  await updateJobRecord(job.id, { status: "processing" });

  let evaluatedAiImage = false;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 85_000);
    try {
      const res = await fetch(n8nUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Unica credencial enviada: o segredo do webhook. A chave do Gemini
          // fica guardada como credencial dentro do n8n e nunca sai de la.
          "x-internal-secret": webhookSecret,
        },
        signal: controller.signal,
        body: JSON.stringify({
          mode: "sync",
          jobId: job.id,
          names: job.names,
          retrySeat1: attempt === 2,
          masterBase64,
          selfieBase64,
          jerseyBase64,
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        composedImageBase64?: string;
        modelRefused?: boolean;
        finishReason?: string;
      } | null;

      if (json?.modelRefused === true) {
        await markModelRefusedJob(job.id, startedAt, {
          via: "n8n_cloud",
          attempt,
        });
        return true;
      }

      if (res.ok && json?.ok && json.composedImageBase64) {
        evaluatedAiImage = true;
        const aiBuf = Buffer.from(json.composedImageBase64, "base64");
        const seatCheck = await validateAiSeat1Placement(aiBuf);
        if (seatCheck.valid) {
          await completeAiJob(job, aiBuf, startedAt, {
            via: "n8n_cloud",
            attempt,
          });
          return true;
        }
        await appendAnonymousLog({
          event: "seat_check_rejected",
          jobId: job.id,
          meta: {
            via: "n8n_cloud",
            attempt,
            reason: seatCheck.reason,
            c1GreenPct: seatCheck.chair1EmptyGreenPct,
            c2GreenPct: seatCheck.chair2EmptyGreenPct,
          },
        });
        continue;
      }

      if (res.status === 401 || res.status === 404) {
        break;
      }
    } catch {
      // Unreachable or aborted; fall through when no AI image was evaluated
    } finally {
      clearTimeout(timer);
    }
  }

  if (evaluatedAiImage) {
    await runFallbackPipeline(job.id, "n8n_cloud_seat_check");
    return true;
  }

  return false;
}

/**
 * Agenda o processamento para depois da resposta HTTP. Em serverless (Vercel),
 * after() mantem a funcao viva ate o fim; um `void promise` solto seria
 * congelado assim que a resposta sai.
 */
export function triggerJobProcessing(jobId: string, baseUrl: string): void {
  if (activeWatchdogs.has(jobId)) return;
  activeWatchdogs.add(jobId);
  after(() => processJob(jobId, baseUrl));
}

async function processJob(jobId: string, baseUrl: string): Promise<void> {
  {
    const startedAt = Date.now();
    try {
      const job = await getJobRecord(jobId);
      if (!job) return;

      const selfieBuf = await readPrivateObject(job.selfiePath);
      if (selfieBuf) {
        await mirrorToDriveOutput(job.id, "selfie", selfieBuf);
      }

      // 1A. Modo n8n Cloud primeiro (se N8N_CLOUD_WEBHOOK_URL estiver configurada)
      const n8nSecret = getN8nWebhookSecret();
      const cloudN8nUrl = process.env.N8N_CLOUD_WEBHOOK_URL?.trim();
      if (cloudN8nUrl && !n8nSecret) {
        await appendAnonymousLog({
          event: "n8n_skipped",
          jobId: job.id,
          meta: { reason: "missing_N8N_WEBHOOK_SECRET" },
        });
      }
      if (cloudN8nUrl && n8nSecret) {
        if (!selfieBuf) {
          await updateJobRecord(job.id, {
            status: "error",
            errorCode: "no_face",
          });
          return;
        }
        const handled = await runN8nCloudSync(
          job,
          cloudN8nUrl,
          selfieBuf,
          startedAt,
          n8nSecret
        );
        if (handled) return;
      }

      // 1B. Modo n8n (Cloud sync inline ou callback local)
      const n8nUrl = process.env.N8N_WEBHOOK_URL?.trim();
      if (n8nUrl && n8nUrl !== cloudN8nUrl) {
        const isLocalN8n =
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(n8nUrl);
        const useCloudSyncMode =
          process.env.N8N_MODE === "sync" ||
          (!isLocalN8n && process.env.N8N_MODE !== "callback");

        if (useCloudSyncMode && n8nSecret) {
          if (!selfieBuf) {
            await updateJobRecord(job.id, {
              status: "error",
              errorCode: "no_face",
            });
            return;
          }
          const handled = await runN8nCloudSync(
            job,
            n8nUrl,
            selfieBuf,
            startedAt,
            n8nSecret
          );
          if (handled) return;
        } else if (!useCloudSyncMode) {
          const selfieSignedUrl = `${baseUrl}${buildSignedMediaUrl(
            "read",
            job.selfiePath,
            10 * 60 * 1000
          )}`;
          const payload = {
            jobId: job.id,
            names: job.names,
            selfieSignedUrl,
            masterUrl: `${baseUrl}/pipeline/master.jpg`,
            jerseyUrl: `${baseUrl}/pipeline/camisa.png`,
            composeUrl: `${baseUrl}/api/internal/compose`,
            jobPatchUrl: `${baseUrl}/api/internal/jobs/${job.id}`,
          };

          await updateJobRecord(job.id, { status: "processing" });

          try {
            const webhookRes = await fetch(n8nUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-secret": getInternalSecret(),
              },
              body: JSON.stringify(payload),
            });
            if (!webhookRes.ok) {
              await runFallbackPipeline(job.id, "n8n_http_error");
              return;
            }

            // Watchdog para acionar Plano B automaticamente caso o n8n nao conclua
            await sleep(CAMPAIGN_CONFIG.limits.aiTimeoutMs);
            const check = await getJobRecord(job.id);
            if (check && (check.status === "queued" || check.status === "processing")) {
              await runFallbackPipeline(job.id, "timeout");
            }
            return;
          } catch {
            await runFallbackPipeline(job.id, "n8n_unreachable");
            return;
          }
        }
      }

      // 2. Modo Direto Gemini Nano Banana 2.1 (se GEMINI_API_KEY estiver configurada)
      if (process.env.GEMINI_API_KEY?.trim()) {
        await updateJobRecord(job.id, { status: "processing" });
        const [masterBuf, shirtBuf] = await Promise.all([
          fs.readFile(path.resolve(CAMPAIGN_CONFIG.assets.masterImage)),
          fs.readFile(path.resolve(CAMPAIGN_CONFIG.assets.jerseyImage)),
        ]);

        if (!selfieBuf) {
          await updateJobRecord(job.id, {
            status: "error",
            errorCode: "no_face",
          });
          return;
        }

        const masterB64 = masterBuf.toString("base64");
        const selfieB64 = selfieBuf.toString("base64");
        const shirtB64 = shirtBuf.toString("base64");

        // Tentativa 1 + 1 nova tentativa automatica em erro transitorio ou se cadeira 1 falhar
        let validImageBuffer: Buffer | null = null;
        let lastFailureKind: "model_refused" | "timeout" | "upstream_error" = "upstream_error";

        for (let attempt = 1; attempt <= 2; attempt++) {
          const prefix = attempt === 2 ? PROMPT_B_RETRY_PREFIX : "";
          const attemptResult = await callNanoBananaOnce(
            masterB64,
            selfieB64,
            shirtB64,
            CAMPAIGN_CONFIG.limits.aiTimeoutMs,
            prefix
          );

          if (!attemptResult.ok) {
            lastFailureKind = attemptResult.kind;
            if (attemptResult.kind === "model_refused" || attemptResult.kind === "timeout") {
              break;
            }
            continue;
          }

          const seatCheck = await validateAiSeat1Placement(attemptResult.imageBuffer);
          if (seatCheck.valid) {
            validImageBuffer = attemptResult.imageBuffer;
            break;
          }

          await appendAnonymousLog({
            event: "seat_check_rejected",
            jobId: job.id,
            meta: {
              attempt,
              reason: seatCheck.reason,
              c1GreenPct: seatCheck.chair1EmptyGreenPct,
              c2GreenPct: seatCheck.chair2EmptyGreenPct,
            },
          });
        }

        if (validImageBuffer) {
          await completeAiJob(job, validImageBuffer, startedAt);
          return;
        }

        if (lastFailureKind === "model_refused") {
          await markModelRefusedJob(job.id, startedAt);
          return;
        }

        await runFallbackPipeline(job.id, lastFailureKind);
        return;
      }

      // 3. Modo Prototipo / Plano B Automatico (sem chaves externas)
      // Pequena janela para o usuario vivenciar os textos rotativos na tela de espera
      await sleep(900);
      await updateJobRecord(job.id, { status: "processing" });
      await sleep(2500);
      await runFallbackPipeline(job.id, "local_demo_mode");
    } catch {
      await runFallbackPipeline(jobId, "unexpected_error").catch(() => undefined);
    } finally {
      activeWatchdogs.delete(jobId);
    }
  }
}
