import { NextRequest, NextResponse } from "next/server";
import { UX_COPY } from "@/config/copy.config";
import {
  composeArquibancadaImage,
  validateAiSeat1Placement,
} from "@/lib/composer";
import {
  isAuthorizedInternalRequest,
  unauthorizedResponse,
} from "@/lib/http";
import {
  appendAnonymousLog,
  getJobRecord,
  updateJobRecord,
} from "@/lib/jobStore";
import { mirrorToDriveOutput } from "@/lib/driveSync";
import { buildSignedMediaUrl, savePrivateObject } from "@/lib/storage";
import { validatePersonName } from "@/lib/validation";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedInternalRequest(req)) {
    return unauthorizedResponse();
  }

  const body = (await req.json().catch(() => null)) as {
    jobId?: string;
    mode?: "ai" | "fallback";
    names?: [string, string, string];
    userName?: string | null;
    composedImageBase64?: string;
    composedImageUrl?: string;
    strictSeatCheck?: boolean;
  } | null;

  if (!body?.jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const job = await getJobRecord(body.jobId).catch(() => null);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const mode: "ai" | "fallback" =
    body.mode === "ai" || body.composedImageBase64 || body.composedImageUrl
      ? "ai"
      : "fallback";

  let baseBuffer: Buffer | undefined;
  if (mode === "ai") {
    if (body.composedImageBase64) {
      const cleanedB64 = body.composedImageBase64.replace(
        /^data:image\/[a-zA-Z+]+;base64,/,
        ""
      );
      baseBuffer = Buffer.from(cleanedB64, "base64");
    } else if (body.composedImageUrl) {
      const upstream = await fetch(body.composedImageUrl).catch(() => null);
      if (upstream?.ok) {
        baseBuffer = Buffer.from(await upstream.arrayBuffer());
      }
    }
    if (!baseBuffer || baseBuffer.length === 0) {
      return NextResponse.json(
        { error: "Missing composed image data for ai mode" },
        { status: 400 }
      );
    }

    if (body.strictSeatCheck === true) {
      const seatCheck = await validateAiSeat1Placement(baseBuffer);
      if (!seatCheck.valid) {
        await appendAnonymousLog({
          event: "seat_check_rejected",
          jobId: job.id,
          meta: {
            reason: seatCheck.reason,
            c1GreenPct: seatCheck.chair1EmptyGreenPct,
            c2GreenPct: seatCheck.chair2EmptyGreenPct,
            c3GreenPct: seatCheck.chair3EmptyGreenPct,
            c4GreenPct: seatCheck.chair4EmptyGreenPct,
          },
        });
        return NextResponse.json(
          {
            ok: false,
            error: "Person not cleanly positioned in Chair 1",
            code: "seat_misplaced",
            seatCheck,
          },
          { status: 422 }
        );
      }
    }
  }

  const targetNames: [string, string, string] =
    Array.isArray(body.names) && body.names.length === 3
      ? [body.names[0], body.names[1], body.names[2]]
      : job.names;

  for (let i = 0; i < 3; i++) {
    const check = validatePersonName(targetNames[i], i + 1);
    if (!check.valid) {
      return NextResponse.json(
        { error: check.message || UX_COPY.errors.blockedName },
        { status: 400 }
      );
    }
    targetNames[i] = check.cleaned;
  }

  const composed = await composeArquibancadaImage({
    mode,
    baseImageBuffer: baseBuffer,
    names: targetNames,
    userName: body.userName ?? job.userName,
  });

  const outPath = `out/${job.id}.jpg`;
  await savePrivateObject(outPath, composed);
  await mirrorToDriveOutput(job.id, "resultado", composed);

  const nextStatus = mode === "ai" ? "done" : "done_fallback";
  await updateJobRecord(job.id, {
    status: nextStatus,
    imagePath: outPath,
    errorCode: null,
  });

  await appendAnonymousLog({
    event: mode === "ai" ? "job_done" : "job_fallback",
    jobId: job.id,
    status: nextStatus,
    meta: { via: "internal_compose" },
  });

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    status: nextStatus,
    imagePath: outPath,
    imageUrl: buildSignedMediaUrl("read", outPath),
  });
}
