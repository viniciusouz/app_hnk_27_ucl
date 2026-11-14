import { NextRequest, NextResponse } from "next/server";
import { getJobRecord } from "@/lib/jobStore";
import { readPrivateObject } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const job = await getJobRecord(id).catch(() => null);
  if (
    !job ||
    !job.imagePath ||
    (job.status !== "done" && job.status !== "done_fallback")
  ) {
    return NextResponse.json(
      { error: "Imagem indisponível ou expirada." },
      { status: 404 }
    );
  }

  const buffer = await readPrivateObject(job.imagePath);
  if (!buffer) {
    return NextResponse.json(
      { error: "Arquivo de imagem não encontrado." },
      { status: 404 }
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=60, must-revalidate",
    },
  });
}
