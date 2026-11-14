import { NextRequest, NextResponse } from "next/server";
import { deleteJobRecord, getJobRecord } from "@/lib/jobStore";
import { buildSignedMediaUrl } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const job = await getJobRecord(id).catch(() => null);
  if (!job) {
    return NextResponse.json(
      { error: "Essa arquibancada já esvaziou.", code: "expired" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    errorCode: job.errorCode,
    names: job.names,
    userName: job.userName,
    requiresUserName: job.status === "done_fallback" && !job.userName,
    imageUrl: job.imagePath ? buildSignedMediaUrl("read", job.imagePath) : null,
    shareUrl: `/s/${job.id}`,
    expiresAt: job.expiresAt,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  await deleteJobRecord(id).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
