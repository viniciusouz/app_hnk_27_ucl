import React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { InviteView } from "@/components/InviteView";
import { UX_COPY } from "@/config/copy.config";
import { getJobRecord } from "@/lib/jobStore";

export const dynamic = "force-dynamic";

async function resolvePublicBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3033";
  return `${proto}://${host}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobRecord(id).catch(() => null);
  const baseUrl = await resolvePublicBaseUrl();

  if (
    !job ||
    !job.imagePath ||
    (job.status !== "done" && job.status !== "done_fallback")
  ) {
    return {
      title: `${UX_COPY.invite.expiredTitle} | Heineken`,
      description: UX_COPY.invite.expiredMessage,
    };
  }

  const title = job.userName
    ? UX_COPY.invite.titleWithName(job.userName)
    : UX_COPY.invite.titleAnonymous;
  const imageUrl = `${baseUrl}/api/share-image/${encodeURIComponent(id)}`;

  return {
    title,
    description: `${UX_COPY.invite.support} ${UX_COPY.brandSignature}.`,
    openGraph: {
      title,
      description: `${UX_COPY.invite.support} ${UX_COPY.brandSignature}.`,
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1080,
          height: 1350,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: UX_COPY.invite.support,
      images: [imageUrl],
    },
  };
}

export default async function ShareInvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJobRecord(id).catch(() => null);
  const isAvailable = Boolean(
    job &&
      job.imagePath &&
      (job.status === "done" || job.status === "done_fallback")
  );

  return (
    <InviteView
      jobId={id}
      expired={!isAvailable}
      inviterName={job?.userName ?? null}
      names={job?.names ?? null}
      imageUrl={isAvailable ? `/api/share-image/${encodeURIComponent(id)}` : null}
    />
  );
}
