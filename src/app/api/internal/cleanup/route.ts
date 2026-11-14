import { NextRequest, NextResponse } from "next/server";
import {
  isAuthorizedInternalRequest,
  unauthorizedResponse,
} from "@/lib/http";
import { appendAnonymousLog, cleanupExpiredJobs } from "@/lib/jobStore";
import { timingSafeCompare } from "@/lib/security";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization") || "";
  const isCronAuthorized =
    Boolean(cronSecret) &&
    authHeader.startsWith("Bearer ") &&
    timingSafeCompare(authHeader.slice(7), cronSecret!);

  if (!isAuthorizedInternalRequest(req) && !isCronAuthorized) {
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
