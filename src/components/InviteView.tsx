"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CAMPAIGN_CONFIG } from "@/config/campaign.config";
import { UX_COPY } from "@/config/copy.config";
import { AppShell } from "./AppShell";

interface InviteViewProps {
  jobId: string;
  expired: boolean;
  inviterName: string | null;
  names: [string, string, string] | null;
  imageUrl: string | null;
}

const AGE_STORAGE_KEY = "hnk_ucl27_age_18_ok";

export function InviteView({
  jobId,
  expired,
  inviterName,
  names,
  imageUrl,
}: InviteViewProps) {
  const [ageVerified, setAgeVerified] = useState(false);
  const [ageBlocked, setAgeBlocked] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(AGE_STORAGE_KEY) === "1") {
        setAgeVerified(true);
      }
    } catch {
      // ignora erro de storage
    }
  }, []);

  if (!ageVerified) {
    return (
      <AppShell>
        <div
          className="screen-enter"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              border: "2px solid #FFFFFF",
              background: "rgba(0, 95, 42, 0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 19,
              fontWeight: 700,
              position: "relative",
            }}
          >
            <span>{UX_COPY.ageGate.badge}</span>
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 12,
                height: 12,
                borderRadius: 6,
                background: "#D10003",
                border: "2px solid #FFFFFF",
              }}
            />
          </div>

          {!ageBlocked ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <h1 className="type-display">{UX_COPY.ageGate.title}</h1>
                <p className="type-body">{UX_COPY.ageGate.support}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    try {
                      window.sessionStorage.setItem(AGE_STORAGE_KEY, "1");
                    } catch {
                      // ignora
                    }
                    setAgeVerified(true);
                  }}
                >
                  {UX_COPY.ageGate.confirmButton}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setAgeBlocked(true)}
                >
                  {UX_COPY.ageGate.denyButton}
                </button>
              </div>
            </>
          ) : (
            <div className="surface-card" style={{ padding: 20 }}>
              <h1 className="type-title">{UX_COPY.ageGate.blockedTitle}</h1>
              <p className="type-body" style={{ color: "#FFFFFF", marginTop: 8 }}>
                {UX_COPY.ageGate.blockedMessage}
              </p>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  if (expired || !imageUrl) {
    return (
      <AppShell>
        <div
          className="screen-enter"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <div className="surface-card" style={{ padding: 24, textAlign: "center" }}>
            <h1 className="type-title">{UX_COPY.invite.expiredTitle}</h1>
            <p className="type-body" style={{ marginTop: 10, color: "#FFFFFF" }}>
              {UX_COPY.invite.expiredMessage}
            </p>
          </div>
          <Link href="/" className="btn-primary">
            {UX_COPY.invite.cta}
          </Link>
        </div>
      </AppShell>
    );
  }

  const headline = inviterName
    ? UX_COPY.invite.titleWithName(inviterName)
    : UX_COPY.invite.titleAnonymous;

  return (
    <AppShell>
      <div
        className="screen-enter"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#E8F5EB",
            }}
          >
            {UX_COPY.invite.eyebrow}
          </span>
          <h1 className="type-display" style={{ fontSize: 30, lineHeight: "34px" }}>
            {headline}
          </h1>
        </div>

        <div
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: 292,
            aspectRatio: "4 / 5",
            borderRadius: 16,
            overflow: "hidden",
            border: "1.5px solid rgba(255,255,255,0.45)",
            background: "#005F2A",
            boxShadow: "0 14px 32px rgba(0, 32, 10, 0.38)",
          }}
        >
          <img
            src={imageUrl}
            alt={`Arquibancada compartilhada com os lugares ${
              names ? names.join(", ") : "dos amigos"
            }.`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>

        <p className="type-body">{UX_COPY.invite.support}</p>

        <div style={{ flex: 1 }} />

        <Link
          href={`/?from=${encodeURIComponent(jobId)}`}
          className="btn-primary"
        >
          {UX_COPY.invite.cta}
        </Link>

        <div
          className="surface-card"
          style={{
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, lineHeight: "18px" }}>
            {UX_COPY.result.promoText}
          </p>
          <a
            href={CAMPAIGN_CONFIG.clubeHeinekenUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 14,
              fontWeight: 700,
              lineHeight: "20px",
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
            }}
          >
            {UX_COPY.result.promoLink}
          </a>
        </div>
      </div>
    </AppShell>
  );
}
