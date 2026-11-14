import React from "react";
import { ArquibancadaFlow } from "@/components/ArquibancadaFlow";
import { HomeHeadlineRouteKey } from "@/config/copy.config";
import { getJobRecord } from "@/lib/jobStore";

interface HomePageProps {
  searchParams: Promise<{
    rota?: string;
    from?: string;
    pitch?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const rawRoute = (params.rota || "A").toUpperCase();
  const initialRoute: HomeHeadlineRouteKey =
    rawRoute === "B" || rawRoute === "C" ? rawRoute : "A";

  const pitchMode = params.pitch === "1";

  const inviterFromId =
    params.from && /^[a-zA-Z0-9_-]{4,24}$/.test(params.from)
      ? params.from
      : null;

  let inviterName: string | null = null;
  if (inviterFromId) {
    const inviterJob = await getJobRecord(inviterFromId).catch(() => null);
    inviterName = inviterJob?.userName ?? null;
  }

  return (
    <ArquibancadaFlow
      initialRoute={initialRoute}
      pitchMode={pitchMode}
      inviterFromId={inviterFromId}
      inviterName={inviterName}
    />
  );
}
