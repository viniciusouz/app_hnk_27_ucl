import { NextRequest, NextResponse } from "next/server";
import { CAMPAIGN_CONFIG } from "@/config/campaign.config";
import { attachDeviceCookie, resolveDeviceHash } from "@/lib/http";
import { buildSignedMediaUrl, newSelfieStoragePath } from "@/lib/storage";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { deviceId, isNewCookie } = resolveDeviceHash(req);
  const { selfiePath } = newSelfieStoragePath();
  const ttlMs = 10 * 60 * 1000;
  const uploadUrl = buildSignedMediaUrl("upload", selfiePath, ttlMs);

  const res = NextResponse.json({
    uploadUrl,
    selfiePath,
    maxBytes: CAMPAIGN_CONFIG.limits.maxUploadBytes,
    expiresInSeconds: Math.round(ttlMs / 1000),
  });

  if (isNewCookie) {
    attachDeviceCookie(res, deviceId);
  }
  return res;
}
