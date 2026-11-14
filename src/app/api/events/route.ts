import { NextRequest, NextResponse } from "next/server";
import { appendAnonymousLog } from "@/lib/jobStore";

const ALLOWED_EVENTS = new Set([
  "app_opened",
  "age_confirmed",
  "age_denied",
  "photo_uploaded",
  "job_created",
  "job_done",
  "job_fallback",
  "share_clicked",
  "download_clicked",
  "invite_accepted",
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as {
    event?: unknown;
    jobId?: unknown;
    routeVariant?: unknown;
    channel?: unknown;
  } | null;

  const event = typeof body?.event === "string" ? body.event.trim() : "";
  if (!ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const meta: Record<string, string | number | boolean> = {};
  if (typeof body?.routeVariant === "string" && body.routeVariant.length <= 16) {
    meta.routeVariant = body.routeVariant;
  }
  if (typeof body?.channel === "string" && body.channel.length <= 24) {
    meta.channel = body.channel;
  }

  const jobId =
    typeof body?.jobId === "string" && /^[a-zA-Z0-9_-]{4,24}$/.test(body.jobId)
      ? body.jobId
      : undefined;

  await appendAnonymousLog({ event, jobId, meta });
  return NextResponse.json({ ok: true });
}
