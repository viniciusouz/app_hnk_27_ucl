"use client";

import React from "react";

interface ChairsPreviewProps {
  mode: "home" | "names" | "waiting";
  names?: [string, string, string];
  activeStep?: number;
  photoThumb?: string | null;
}

interface StadiumBucketSeatProps {
  seatIndex: number;
  label: string;
  isUser: boolean;
  isOccupied: boolean;
  isAnimating: boolean;
  photoThumb?: string | null;
}

function StadiumBucketSeat({
  seatIndex,
  label,
  isUser,
  isOccupied,
  isAnimating,
  photoThumb,
}: StadiumBucketSeatProps) {
  const shellGradId = `seatShellGrad-${seatIndex}`;
  const cavityGradId = `seatCavityGrad-${seatIndex}`;
  const panGradId = `seatPanGrad-${seatIndex}`;
  const lipGradId = `seatLipGrad-${seatIndex}`;
  const glossGradId = `seatGlossGrad-${seatIndex}`;

  const fontSize =
    label.length > 9 ? 8.5 : label.length > 6 ? 10 : isOccupied ? 11.5 : 17;

  return (
    <div
      className={isAnimating ? "seat-animating" : ""}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "100 / 124",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 124"
        width="100%"
        height="100%"
        style={{
          display: "block",
          overflow: "visible",
          filter: isOccupied
            ? "drop-shadow(0 4px 8px rgba(0, 18, 5, 0.45))"
            : "drop-shadow(0 2px 4px rgba(0, 18, 5, 0.25))",
        }}
      >
        <defs>
          <linearGradient id={shellGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isOccupied ? "#2DC245" : "#0B6627"} />
            <stop offset="55%" stopColor={isOccupied ? "#00871F" : "#004D1C"} />
            <stop offset="100%" stopColor={isOccupied ? "#005913" : "#003914"} />
          </linearGradient>

          <linearGradient id={cavityGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isOccupied ? "#1F9F34" : "#085420"} />
            <stop offset="65%" stopColor={isOccupied ? "#007118" : "#004218"} />
            <stop offset="100%" stopColor={isOccupied ? "#004B10" : "#003010"} />
          </linearGradient>

          <linearGradient id={panGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isOccupied ? "#004D10" : "#003312"} />
            <stop offset="100%" stopColor={isOccupied ? "#0D7F22" : "#06491B"} />
          </linearGradient>

          <linearGradient id={lipGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isOccupied ? "#38CE4F" : "#157330"} />
            <stop offset="60%" stopColor={isOccupied ? "#18942B" : "#0B5621"} />
            <stop offset="100%" stopColor={isOccupied ? "#005E14" : "#003813"} />
          </linearGradient>

          <linearGradient id={glossGradId} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity={isOccupied ? "0.34" : "0.14"} />
            <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Casca externa moldada do banco de estadio (ombros arredondados e abas laterais) */}
        <path
          d="M 24 6 Q 50 2 76 6 Q 85 7 87 17 L 95 86 Q 96 94 90 98 L 10 98 Q 4 94 5 86 L 13 17 Q 15 7 24 6 Z"
          fill={isOccupied ? `url(#${shellGradId})` : "rgba(0, 62, 24, 0.85)"}
          stroke={isOccupied ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.34)"}
          strokeWidth="1.5"
        />

        {/* Cavidade interna rebaixada do encosto */}
        <path
          d="M 27 12 Q 50 9 73 12 Q 79 13 81 21 L 87 83 Q 87 88 82 89 L 18 89 Q 13 88 13 83 L 19 21 Q 21 13 27 12 Z"
          fill={isOccupied ? `url(#${cavityGradId})` : "rgba(0, 48, 18, 0.72)"}
          stroke={isOccupied ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.42)"}
          strokeWidth="1.15"
          strokeDasharray={isOccupied ? undefined : "4 3"}
        />

        {/* Reflexo especular plastico no encosto ocupado */}
        <path
          d="M 27 12 Q 50 9 73 12 Q 78 13 80 20 L 83 52 Q 54 44 17 56 L 19 20 Q 21 13 27 12 Z"
          fill={`url(#${glossGradId})`}
        />

        {isOccupied ? (
          <path
            d="M 20 18 Q 22 10 40 8.5"
            fill="none"
            stroke="rgba(255,255,255,0.52)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ) : null}

        {/* Concha inferior curva do assento projetado */}
        <path
          d="M 10 91 Q 50 96 90 91 L 94 103 Q 50 109 6 103 Z"
          fill={`url(#${panGradId})`}
          stroke={isOccupied ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)"}
          strokeWidth="1"
        />

        {/* Borda frontal curva do banco de arquibancada */}
        <path
          d="M 6 100 Q 50 106 94 100 L 92 112 Q 50 119 8 112 Z"
          fill={isOccupied ? `url(#${lipGradId})` : "rgba(0, 68, 26, 0.75)"}
          stroke={isOccupied ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.3)"}
          strokeWidth="1.3"
        />

        {/* Brilho da borda frontal */}
        <path
          d="M 12 104.5 Q 50 110.5 88 104.5"
          fill="none"
          stroke={isOccupied ? "rgba(255,255,255,0.48)" : "rgba(255,255,255,0.18)"}
          strokeWidth="1.1"
          strokeLinecap="round"
        />

        {/* Estrela vermelha Heineken no topo do encosto */}
        <polygon
          points="50,16.5 52.1,21.8 57.8,22.3 53.4,26.1 54.7,31.7 50,28.7 45.3,31.7 46.6,26.1 42.2,22.3 47.9,21.8"
          fill="#D10003"
          stroke="#FFFFFF"
          strokeWidth="1.05"
          strokeLinejoin="round"
        />
      </svg>

      {/* Area central do nome ou foto dentro do encosto do banco */}
      <div
        style={{
          position: "absolute",
          left: "13%",
          right: "13%",
          top: "30%",
          bottom: "25%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {isUser && photoThumb ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <img
              src={photoThumb}
              alt="Sua miniatura"
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                objectFit: "cover",
                border: "1.5px solid #FFFFFF",
              }}
            />
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                lineHeight: 1,
                color: "#FFFFFF",
                textShadow: "0 1px 2px rgba(0, 28, 8, 0.75)",
              }}
            >
              Você
            </span>
          </div>
        ) : (
          <span
            style={{
              fontSize,
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#FFFFFF",
              textAlign: "center",
              wordBreak: "break-word",
              textShadow: "0 1px 2px rgba(0, 28, 8, 0.72)",
              maxWidth: "100%",
              paddingInline: 2,
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export function ChairsPreview({
  mode,
  names = ["", "", ""],
  activeStep = 0,
  photoThumb,
}: ChairsPreviewProps) {
  const chairs = [
    { label: "Você", isUser: true, filled: true },
    {
      label: names[0]?.trim().toUpperCase() || "?",
      isUser: false,
      filled: Boolean(names[0]?.trim()),
    },
    {
      label: names[1]?.trim().toUpperCase() || "?",
      isUser: false,
      filled: Boolean(names[1]?.trim()),
    },
    {
      label: names[2]?.trim().toUpperCase() || "?",
      isUser: false,
      filled: Boolean(names[2]?.trim()),
    },
  ];

  const ariaSummary =
    mode === "home"
      ? "Quatro bancos verdes de arquibancada em fila: o primeiro ocupado por você e três vazios para seus amigos."
      : `Quatro bancos verdes de arquibancada em fila: você no primeiro e os nomes ${chairs
          .slice(1)
          .map((c) => (c.filled ? c.label : "vazio"))
          .join(", ")}.`;

  return (
    <div
      role="img"
      aria-label={ariaSummary}
      style={{
        position: "relative",
        borderRadius: 16,
        background:
          "linear-gradient(180deg, #00441D 0%, #005525 60%, #003816 100%)",
        border: "1px solid rgba(255,255,255,0.22)",
        padding: "14px 10px 12px",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
      }}
    >
      {/* Trilho horizontal de arquibancada conectando os 4 bancos */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          bottom: 18,
          height: 6,
          borderRadius: 3,
          background:
            "linear-gradient(180deg, #00290F 0%, #0A4A21 50%, #001F0B 100%)",
          opacity: 0.92,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 5,
        }}
      >
        {chairs.map((chair, idx) => {
          const isOccupied =
            chair.isUser ||
            (mode === "names" && chair.filled) ||
            (mode === "waiting" && idx <= activeStep);

          return (
            <StadiumBucketSeat
              key={idx}
              seatIndex={idx}
              label={chair.label}
              isUser={chair.isUser}
              isOccupied={isOccupied}
              isAnimating={mode === "waiting" && idx === activeStep}
              photoThumb={photoThumb}
            />
          );
        })}
      </div>
    </div>
  );
}
