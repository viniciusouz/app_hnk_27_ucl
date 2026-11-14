import "./fontconfigInit";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { CAMPAIGN_CONFIG } from "@/config/campaign.config";
import { SEATS_LAYOUT_CONFIG } from "@/config/seats.config";

function escapePango(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isGreenPlasticSeatPixel(r: number, g: number, b: number): boolean {
  return g > 38 && g > r * 1.35 && g > b * 1.28;
}

let cachedMasterRgb: Promise<Buffer> | null = null;

async function getMasterRawRgb(): Promise<Buffer> {
  if (!cachedMasterRgb) {
    const { width, height } = SEATS_LAYOUT_CONFIG;
    cachedMasterRgb = fs
      .readFile(path.join(process.cwd(), CAMPAIGN_CONFIG.assets.masterImage))
      .then((buf) =>
        sharp(buf)
          .resize(width, height, { fit: "cover", position: "center" })
          .removeAlpha()
          .raw()
          .toBuffer()
      );
  }
  return cachedMasterRgb;
}

export interface SeatPlacementCheckResult {
  valid: boolean;
  reason: string;
  chair1EmptyGreenPct: number;
  chair1AvgDiff: number;
  chair2EmptyGreenPct: number;
  chair3EmptyGreenPct: number;
  chair4EmptyGreenPct: number;
}

export async function validateAiSeat1Placement(
  aiImageBuffer: Buffer
): Promise<SeatPlacementCheckResult> {
  const { width, height } = SEATS_LAYOUT_CONFIG;
  const [aiRaw, masterRaw] = await Promise.all([
    sharp(aiImageBuffer)
      .resize(width, height, { fit: "cover", position: "center" })
      .removeAlpha()
      .raw()
      .toBuffer(),
    getMasterRawRgb(),
  ]);

  function measureBox(x1: number, x2: number, y1: number, y2: number) {
    let greenCount = 0;
    let diffSum = 0;
    let total = 0;
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const idx = (y * width + x) * 3;
        const r = aiRaw[idx];
        const g = aiRaw[idx + 1];
        const b = aiRaw[idx + 2];
        if (isGreenPlasticSeatPixel(r, g, b)) {
          greenCount++;
        }
        diffSum +=
          Math.abs(r - masterRaw[idx]) +
          Math.abs(g - masterRaw[idx + 1]) +
          Math.abs(b - masterRaw[idx + 2]);
        total++;
      }
    }
    return {
      emptyGreenPct: +((greenCount / Math.max(1, total)) * 100).toFixed(1),
      avgDiff: +(diffSum / Math.max(1, total)).toFixed(1),
    };
  }

  const c1 = measureBox(108, 256, 740, 900);
  const c2 = measureBox(352, 505, 765, 900);
  const c3 = measureBox(585, 740, 765, 900);
  const c4 = measureBox(820, 975, 765, 900);

  let valid = true;
  let reason = "ok";

  if (c1.emptyGreenPct > 52 || c1.avgDiff < 48) {
    valid = false;
    reason = "chair1_not_occupied";
  } else if (
    c2.emptyGreenPct < 82 ||
    c3.emptyGreenPct < 85 ||
    c4.emptyGreenPct < 85
  ) {
    valid = false;
    reason = "friend_chair_occupied";
  }

  return {
    valid,
    reason,
    chair1EmptyGreenPct: c1.emptyGreenPct,
    chair1AvgDiff: c1.avgDiff,
    chair2EmptyGreenPct: c2.emptyGreenPct,
    chair3EmptyGreenPct: c3.emptyGreenPct,
    chair4EmptyGreenPct: c4.emptyGreenPct,
  };
}

function findSafeHorizontalSpanInChair(
  rawRgb: Buffer,
  imgWidth: number,
  imgHeight: number,
  chairLeftPx: number,
  chairRightPx: number,
  bandTopY: number,
  bandBottomY: number
): { safeLeft: number; safeRight: number } | null {
  const scanStart = Math.max(0, chairLeftPx + 8);
  const scanEnd = Math.min(imgWidth - 1, chairRightPx - 8);
  const yStart = Math.max(812, bandTopY);
  const yEnd = Math.min(imgHeight - 1, bandBottomY);
  const colHeight = Math.max(1, yEnd - yStart + 1);

  let bestStart = -1;
  let bestEnd = -1;
  let curStart = -1;

  for (let x = scanStart; x <= scanEnd; x++) {
    let greenPixels = 0;
    for (let y = yStart; y <= yEnd; y++) {
      const idx = (y * imgWidth + x) * 3;
      if (isGreenPlasticSeatPixel(rawRgb[idx], rawRgb[idx + 1], rawRgb[idx + 2])) {
        greenPixels++;
      }
    }
    const isCleanCol = greenPixels / colHeight >= 0.92;
    if (isCleanCol) {
      if (curStart === -1) curStart = x;
      if (x - curStart > bestEnd - bestStart) {
        bestStart = curStart;
        bestEnd = x;
      }
    } else {
      curStart = -1;
    }
  }

  if (bestStart === -1 || bestEnd - bestStart < 56) {
    return null;
  }

  const safeLeft = bestStart > scanStart + 4 ? bestStart + 14 : bestStart + 4;
  const safeRight = bestEnd < scanEnd - 4 ? bestEnd - 14 : bestEnd - 4;
  if (safeRight - safeLeft < 48) {
    return null;
  }
  return { safeLeft, safeRight };
}

interface TextLayerInput {
  text: string;
  fontName: string;
  fontFile: string;
  color: string;
  maxWidth: number;
  maxHeight: number;
  dpi?: number;
  align?: "left" | "centre" | "right";
}

async function renderTextImage(input: TextLayerInput): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
}> {
  const safeText = escapePango(input.text);
  const dpi = input.dpi ?? 240;

  const rawTextBuf = await sharp({
    text: {
      text: `<span foreground="${input.color}">${safeText}</span>`,
      font: input.fontName,
      fontfile: input.fontFile,
      align: input.align ?? "centre",
      rgba: true,
      dpi,
    },
  })
    .png()
    .toBuffer();

  const meta = await sharp(rawTextBuf).metadata();
  const w = meta.width || 100;
  const h = meta.height || 40;

  if (w > input.maxWidth || h > input.maxHeight) {
    const resized = await sharp(rawTextBuf)
      .resize({
        width: input.maxWidth,
        height: input.maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    const rMeta = await sharp(resized).metadata();
    return {
      buffer: resized,
      width: rMeta.width || input.maxWidth,
      height: rMeta.height || input.maxHeight,
    };
  }

  return { buffer: rawTextBuf, width: w, height: h };
}

async function createSoftDropShadow(
  textBuf: Buffer,
  opacity = 0.55
): Promise<Buffer> {
  const { data, info } = await sharp(textBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const shadowPixels = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    shadowPixels[i] = 0;
    shadowPixels[i + 1] = 28;
    shadowPixels[i + 2] = 6;
    shadowPixels[i + 3] = Math.round(data[i + 3] * opacity);
  }

  return sharp(shadowPixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .blur(1.8)
    .png()
    .toBuffer();
}

export interface ComposeSeatImageOptions {
  mode: "ai" | "fallback";
  baseImageBuffer?: Buffer;
  names: [string, string, string];
  userName?: string | null;
}

export async function composeArquibancadaImage(
  opts: ComposeSeatImageOptions
): Promise<Buffer> {
  const { width, height, seats } = SEATS_LAYOUT_CONFIG;

  const serifBoldFile = path.join(process.cwd(), "public/fonts/HeinekenSerif18-Bold.ttf");
  const sansRegularFile = path.join(process.cwd(), "public/fonts/HeinekenSans-Regular.ttf");

  const baseSource =
    opts.baseImageBuffer ??
    (await fs.readFile(path.join(process.cwd(), CAMPAIGN_CONFIG.assets.fallbackImage)));

  const normalizedBase = await sharp(baseSource)
    .resize(width, height, { fit: "cover", position: "center" })
    .jpeg({ quality: 96 })
    .toBuffer();

  const normalizedRawRgb =
    opts.mode === "ai"
      ? await sharp(normalizedBase).removeAlpha().raw().toBuffer()
      : null;

  const composites: sharp.OverlayOptions[] = [];

  // 1. Faixa inferior grafica (ultimos 25% da imagem: degrade estadio -> #007118 + Racetrack)
  const footerBandHeight = Math.round(height * 0.25); // 338px
  const footerTop = height - footerBandHeight;

  const footerBgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${footerBandHeight}" viewBox="0 0 ${width} ${footerBandHeight}">
    <defs>
      <linearGradient id="hnkFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#003E10" stop-opacity="0"/>
        <stop offset="30%" stop-color="#005F2A" stop-opacity="0.72"/>
        <stop offset="56%" stop-color="#007118" stop-opacity="0.98"/>
        <stop offset="100%" stop-color="#007118" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${width}" height="${footerBandHeight}" fill="url(#hnkFade)"/>
    <g transform="translate(760, 128) scale(1.08)">
      <path d="M220.48,0C145.35,0,84.23,55.33,84.23,123.33v92.08c0,68.01,61.12,123.33,136.25,123.33s136.25-55.33,136.25-123.33v-92.08C356.73,55.33,295.61,0,220.48,0Z" fill="#268913" fill-opacity="0.46"/>
      <path d="M220.48,26C160.2,26,110.23,70.2,110.23,124.2v90.34c0,54,49.97,98.2,110.25,98.2s110.25-44.2,110.25-98.2v-90.34C330.73,70.2,280.76,26,220.48,26Z" fill="#005F2A" fill-opacity="0.42"/>
    </g>
  </svg>`;

  composites.push({
    input: Buffer.from(footerBgSvg),
    top: footerTop,
    left: 0,
  });

  // 2. Logotipo oficial Heineken horizontal sobre fundo verde
  const logoSvgRaw = await fs.readFile(
    path.join(process.cwd(), CAMPAIGN_CONFIG.assets.logoExtHorizOnGreen)
  );
  const logoPng = await sharp(logoSvgRaw, { density: 260 })
    .resize({ width: 230, height: 64, fit: "inside" })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logoPng).metadata();
  const logoWidth = logoMeta.width || 230;
  const logoHeight = logoMeta.height || 62;

  composites.push({
    input: logoPng,
    left: 64,
    top: footerTop + 206,
  });

  // 3. Assinatura da campanha em Heineken Serif 18 Bold
  const signatureRendered = await renderTextImage({
    text: "Mais Amigos, Mais Champions.",
    fontName: "Heineken Serif 18 Bold",
    fontFile: serifBoldFile,
    color: "#FFFFFF",
    maxWidth: 660,
    maxHeight: 50,
    dpi: 245,
    align: "left",
  });
  composites.push({
    input: signatureRendered.buffer,
    left: 64 + logoWidth + 28,
    top:
      footerTop +
      206 +
      Math.round((logoHeight - signatureRendered.height) / 2) +
      2,
  });

  // 4. Frase legal obrigatoria
  const legalRendered = await renderTextImage({
    text: "Beba com moderação. Não compartilhe com menores de 18 anos. Consulte o regulamento. Imagem ilustrativa.",
    fontName: "Heineken Sans",
    fontFile: sansRegularFile,
    color: "#E4F3E8",
    maxWidth: 952,
    maxHeight: 28,
    dpi: 112,
    align: "left",
  });
  composites.push({
    input: legalRendered.buffer,
    left: 64,
    top: height - legalRendered.height - 26,
  });

  // 5. Nomes aplicados nas cadeiras com fonte reduzida e trava anti-sobreposicao
  const seatLabels: Array<{ seatIndex: 1 | 2 | 3 | 4; label: string }> = [];

  if (opts.mode === "fallback") {
    const firstChairLabel = (opts.userName || "VOCÊ").trim().toUpperCase();
    seatLabels.push(
      { seatIndex: 1, label: firstChairLabel },
      { seatIndex: 2, label: opts.names[0].trim().toUpperCase() },
      { seatIndex: 3, label: opts.names[1].trim().toUpperCase() },
      { seatIndex: 4, label: opts.names[2].trim().toUpperCase() }
    );
  } else {
    seatLabels.push(
      { seatIndex: 2, label: opts.names[0].trim().toUpperCase() },
      { seatIndex: 3, label: opts.names[1].trim().toUpperCase() },
      { seatIndex: 4, label: opts.names[2].trim().toUpperCase() }
    );
  }

  for (const item of seatLabels) {
    const coord = seats.find((s) => s.index === item.seatIndex);
    if (!coord || !item.label) continue;

    const maxW = Math.round((coord.maxWidthPct / 100) * width);
    const maxH = Math.round((coord.maxHeightPct / 100) * height);

    const len = item.label.length;
    const dpi = len <= 5 ? 148 : len <= 8 ? 140 : 130;

    let nameRendered = await renderTextImage({
      text: item.label,
      fontName: "Heineken Serif 18 Bold",
      fontFile: serifBoldFile,
      color: "#FFFFFF",
      maxWidth: maxW,
      maxHeight: maxH,
      dpi,
      align: "centre",
    });

    let left = Math.round((coord.xPct / 100) * width - nameRendered.width / 2);
    const top = Math.round(
      (coord.yPct / 100) * height - nameRendered.height / 2
    );

    if (normalizedRawRgb) {
      const chairLeftPx = Math.round((coord.chairBoundsXPct[0] / 100) * width);
      const chairRightPx = Math.round((coord.chairBoundsXPct[1] / 100) * width);
      const safeSpan = findSafeHorizontalSpanInChair(
        normalizedRawRgb,
        width,
        height,
        chairLeftPx,
        chairRightPx,
        top - 8,
        top + nameRendered.height + 8
      );

      if (safeSpan) {
        const availableWidth = safeSpan.safeRight - safeSpan.safeLeft;
        if (nameRendered.width > availableWidth) {
          const shrunk = await sharp(nameRendered.buffer)
            .resize({
              width: availableWidth,
              height: maxH,
              fit: "inside",
              withoutEnlargement: true,
            })
            .png()
            .toBuffer();
          const sMeta = await sharp(shrunk).metadata();
          nameRendered = {
            buffer: shrunk,
            width: sMeta.width || availableWidth,
            height: sMeta.height || nameRendered.height,
          };
        }
        left = Math.max(
          safeSpan.safeLeft,
          Math.min(left, safeSpan.safeRight - nameRendered.width)
        );
      }
    }

    const shadowBuf = await createSoftDropShadow(nameRendered.buffer, 0.58);

    composites.push({
      input: shadowBuf,
      left: left + 1,
      top: top + 3,
    });
    composites.push({
      input: nameRendered.buffer,
      left,
      top,
    });
  }

  return sharp(normalizedBase)
    .composite(composites)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
