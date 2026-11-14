import { mirrorToDriveOutput } from "@/lib/driveSync";
import { NextRequest, NextResponse } from "next/server";
import { composeArquibancadaImage } from "@/lib/composer";
import { getJobRecord, updateJobRecord } from "@/lib/jobStore";
import { buildSignedMediaUrl, savePrivateObject } from "@/lib/storage";
import { validatePersonName } from "@/lib/validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const job = await getJobRecord(id).catch(() => null);
  if (!job) {
    return NextResponse.json(
      { error: "Essa arquibancada já esvaziou." },
      { status: 404 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    userName?: unknown;
  } | null;

  const rawName = typeof body?.userName === "string" ? body.userName : "";
  const validation = validatePersonName(rawName);
  if (!validation.valid) {
    return NextResponse.json(
      {
        error: validation.message,
        code: validation.code,
      },
      { status: 400 }
    );
  }

  let updatedPath = job.imagePath;

  // No Plano B (done_fallback), gravamos imediatamente o nome do usuario na cadeira 1
  if (job.status === "done_fallback") {
    const recomposed = await composeArquibancadaImage({
      mode: "fallback",
      names: job.names,
      userName: validation.cleaned,
    });
    const outPath = job.imagePath || `out/${job.id}.jpg`;
    await savePrivateObject(outPath, recomposed);
    updatedPath = outPath;
    await mirrorToDriveOutput(job.id, "resultado", recomposed);
  }

  const updated = await updateJobRecord(job.id, {
    userName: validation.cleaned,
    imagePath: updatedPath,
  });

  return NextResponse.json({
    ok: true,
    userName: updated?.userName ?? validation.cleaned,
    imageUrl: updatedPath ? buildSignedMediaUrl("read", updatedPath) : null,
    shareUrl: `/s/${job.id}`,
  });
}
