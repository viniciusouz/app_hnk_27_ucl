import { NextRequest, NextResponse } from "next/server";
import {
  readPrivateObject,
  validateSignedMediaParams,
} from "@/lib/storage";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const validation = validateSignedMediaParams(
    "read",
    req.nextUrl.searchParams
  );
  if (!validation.ok) {
    return NextResponse.json(
      { error: "URL assinada expirada ou inválida." },
      { status: 403 }
    );
  }

  const data = await readPrivateObject(validation.storagePath);
  if (!data) {
    return NextResponse.json(
      { error: "Imagem expirada ou removida." },
      { status: 404 }
    );
  }

  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  const headers: Record<string, string> = {
    "Content-Type": "image/jpeg",
    "Cache-Control": "private, no-store, max-age=0",
  };
  if (isDownload) {
    headers["Content-Disposition"] =
      'attachment; filename="arquibancada-heineken-ucl-2027.jpg"';
  }

  return new NextResponse(new Uint8Array(data), { status: 200, headers });
}
