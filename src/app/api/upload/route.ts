import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { CAMPAIGN_CONFIG } from "@/config/campaign.config";
import { appendAnonymousLog } from "@/lib/jobStore";
import { savePrivateObject, validateSignedMediaParams } from "@/lib/storage";

function hasValidImageMagicBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return true;
  }
  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  return false;
}

async function handleUpload(req: NextRequest): Promise<NextResponse> {
  const validation = validateSignedMediaParams(
    "upload",
    req.nextUrl.searchParams
  );
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Link de envio expirado ou inválido." },
      { status: 403 }
    );
  }

  let rawBuffer: Buffer;
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Nenhuma foto recebida." },
        { status: 400 }
      );
    }
    rawBuffer = Buffer.from(await file.arrayBuffer());
  } else {
    rawBuffer = Buffer.from(await req.arrayBuffer());
  }

  if (rawBuffer.length === 0) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
  }
  if (rawBuffer.length > CAMPAIGN_CONFIG.limits.maxUploadBytes) {
    return NextResponse.json(
      { error: "A foto passou do limite de 8 MB." },
      { status: 413 }
    );
  }
  if (!hasValidImageMagicBytes(rawBuffer)) {
    return NextResponse.json(
      { error: "Envie uma foto válida em JPEG, PNG ou WebP." },
      { status: 400 }
    );
  }

  try {
    // Normaliza rotacao EXIF e remove todos os metadados pessoais (GPS, camera, etc.)
    const cleanJpeg = await sharp(rawBuffer)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    await savePrivateObject(validation.storagePath, cleanJpeg);
    await appendAnonymousLog({
      event: "photo_uploaded",
      meta: { bytes: cleanJpeg.length },
    });

    return NextResponse.json({
      ok: true,
      selfiePath: validation.storagePath,
      bytes: cleanJpeg.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Não deu para processar esta foto. Tente outra imagem." },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  return handleUpload(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleUpload(req);
}
