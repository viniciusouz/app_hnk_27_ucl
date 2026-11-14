import { NextRequest, NextResponse } from "next/server";
import {
  isAuthorizedInternalRequest,
  unauthorizedResponse,
} from "@/lib/http";
import {
  appendAnonymousLog,
  getJobRecord,
  JobErrorCode,
  JobStatus,
  updateJobRecord,
} from "@/lib/jobStore";

const ALLOWED_STATUSES: Set<JobStatus> = new Set([
  "queued",
  "processing",
  "done",
  "done_fallback",
  "error",
]);

const ALLOWED_ERRORS: Set<Exclude<JobErrorCode, null>> = new Set([
  "no_face",
  "multiple_faces",
  "model_refused",
  "timeout",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAuthorizedInternalRequest(req)) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const existing = await getJobRecord(id).catch(() => null);
  if (!existing) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    status?: string;
    errorCode?: string | null;
    durationMs?: number | null;
    imagePath?: string | null;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<typeof existing> = {};
  if (body.status) {
    if (!ALLOWED_STATUSES.has(body.status as JobStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status as JobStatus;
  }
  if (body.errorCode !== undefined) {
    if (
      body.errorCode !== null &&
      !ALLOWED_ERRORS.has(body.errorCode as Exclude<JobErrorCode, null>)
    ) {
      return NextResponse.json({ error: "Invalid errorCode" }, { status: 400 });
    }
    patch.errorCode = body.errorCode as JobErrorCode;
  }
  if (typeof body.durationMs === "number" && Number.isFinite(body.durationMs)) {
    patch.durationMs = Math.max(0, Math.round(body.durationMs));
  }
  if (
    typeof body.imagePath === "string" &&
    /^out\/[a-zA-Z0-9_-]+\.jpg$/.test(body.imagePath)
  ) {
    patch.imagePath = body.imagePath;
  }

  const updated = await updateJobRecord(id, patch);

  await appendAnonymousLog({
    event: "job_patched",
    jobId: id,
    status: updated?.status,
    durationMs: updated?.durationMs,
    errorCode: updated?.errorCode,
  });

  return NextResponse.json({
    ok: true,
    id,
    status: updated?.status,
    errorCode: updated?.errorCode,
    durationMs: updated?.durationMs,
  });
}
