import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getInternalSecret, hashDeviceId, timingSafeCompare } from "./security";

export const DEVICE_COOKIE_NAME = "hnk_did";

export function getRequestBaseUrl(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3033";
  return `${proto}://${host}`;
}

export function isAuthorizedInternalRequest(req: NextRequest): boolean {
  const provided = req.headers.get("x-internal-secret") || "";
  if (!provided) return false;
  return timingSafeCompare(provided, getInternalSecret());
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function resolveDeviceHash(req: NextRequest): {
  deviceId: string;
  deviceHash: string;
  isNewCookie: boolean;
} {
  const existing = req.cookies.get(DEVICE_COOKIE_NAME)?.value?.trim();
  const deviceId =
    existing && existing.length >= 12
      ? existing
      : crypto.randomBytes(16).toString("base64url");
  return {
    deviceId,
    deviceHash: hashDeviceId(deviceId),
    isNewCookie: !existing || existing.length < 12,
  };
}

export function attachDeviceCookie(res: NextResponse, deviceId: string): void {
  res.cookies.set({
    name: DEVICE_COOKIE_NAME,
    value: deviceId,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
