"use client";

import React, { useState } from "react";
import { CAMPAIGN_CONFIG } from "@/config/campaign.config";
import { UX_COPY } from "@/config/copy.config";
import { RacetrackMotif } from "./RacetrackMotif";

interface AppShellProps {
  children: React.ReactNode;
  step?: 1 | 2 | 3;
  onBack?: () => void;
  showBrandHeader?: boolean;
}

export function AppShell({
  children,
  step,
  onBack,
  showBrandHeader = true,
}: AppShellProps) {
  const [rulesOpen, setRulesOpen] = useState(false);

  const stepText =
    step === 1
      ? UX_COPY.photo.stepLabel
      : step === 2
        ? UX_COPY.names.stepLabel
        : step === 3
          ? UX_COPY.waiting.stepLabel
          : null;

  return (
    <div className="stage-backdrop">
      <div className="mobile-viewport">
        <div className="app-surface-glow" />
        <RacetrackMotif />

        <header className="app-header">
          {showBrandHeader ? (
            <div className="header-brand-row">
              <img
                src="/brand/heineken-logo-exthoriz-on-green.svg"
                alt="Logotipo Heineken"
                className="brand-wordmark"
              />
              <span className="header-tagline">{UX_COPY.brandSignature}</span>
            </div>
          ) : null}

          {step ? (
            <>
              <div className="header-step-row">
                {onBack ? (
                  <button
                    type="button"
                    onClick={onBack}
                    className="back-btn"
                    aria-label="Voltar para a etapa anterior"
                  >
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    <span>Voltar</span>
                  </button>
                ) : (
                  <div />
                )}
                <span className="step-badge">{stepText}</span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Progresso do fluxo"
                aria-valuenow={step}
                aria-valuemin={1}
                aria-valuemax={3}
              >
                <div className="progress-segment active" />
                <div
                  className={`progress-segment ${step >= 2 ? "active" : ""}`}
                />
                <div
                  className={`progress-segment ${step >= 3 ? "active" : ""}`}
                />
              </div>
            </>
          ) : null}
        </header>

        <main className="app-main">{children}</main>

        <footer className="app-footer">
          <span>{UX_COPY.footer.legalPrefix} </span>
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="legal-link-btn"
          >
            {UX_COPY.footer.legalLink}
          </button>
        </footer>

        {rulesOpen ? (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="regulamento-titulo"
          >
            <div className="modal-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <h2 id="regulamento-titulo" className="type-title">
                  {CAMPAIGN_CONFIG.regulamentoSummary.title}
                </h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {CAMPAIGN_CONFIG.regulamentoSummary.paragraphs.map((text, idx) => (
                  <p key={idx} className="type-body" style={{ fontSize: 14 }}>
                    {text}
                  </p>
                ))}
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setRulesOpen(false)}
              >
                Entendi
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
