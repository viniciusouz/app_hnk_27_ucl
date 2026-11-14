import { NextRequest, NextResponse } from "next/server";
import {
  isAuthorizedInternalRequest,
  unauthorizedResponse,
} from "@/lib/http";
import { appendAnonymousLog, cleanupExpiredJobs } from "@/lib/jobStore";
import { timingSafeCompare } from "@/lib/security";

async function handleCleanup(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization") || "";
  const isCronAuthorized =
    Boolean(cronSecret) &&
    authHeader.startsWith("Bearer ") &&
    timingSafeCompare(authHeader.slice(7).trim(), cronSecret!);

  if (!isCronAuthorized && !isAuthorizedInternalRequest(req)) {
    return unauthorizedResponse();
  }

  const result = await cleanupExpiredJobs();
  await appendAnonymousLog({
    event: "cleanup_run",
    meta: { removedCount: result.removedCount },
  });

  return NextResponse.json({
    ok: true,
    removedCount: result.removedCount,
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleCleanup(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleCleanup(req);
}
