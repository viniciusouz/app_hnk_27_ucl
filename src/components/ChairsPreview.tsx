"use client";

import React, { useId } from "react";
import { UX_COPY } from "@/config/copy.config";

/**
 * Fileira de arquibancada em SVG unico, desenhada a partir da cena master
 * (public/pipeline/master.jpg): 4 bancos concha verdes com estrela vermelha,
 * cadeiras vermelhas cortadas nas pontas e viga escura de concreto embaixo.
 * Um so viewBox garante proporcao identica em 320px ou 1440px e evita
 * gradientes duplicados por banco.
 */

interface ChairsPreviewProps {
  mode: "home" | "names" | "waiting";
  names?: [string, string, string];
  activeStep?: number;
  photoThumb?: string | null;
}

type SeatState = "user" | "filled" | "empty";

const VIEW_W = 400;
const VIEW_H = 156;
const SEAT_W = 84;
const SEAT_GAP = 8;
const ROW_X = (VIEW_W - (SEAT_W * 4 + SEAT_GAP * 3)) / 2;

// Area segura do nome no encosto (largura util em unidades do viewBox)
const NAME_MAX_W = 62;

// Encosto: leve abertura no topo, cantos arredondados, afunila ate o assento
const BACKREST_PATH =
  "M 12 6 Q 42 1 72 6 Q 81 7.5 82 17 L 78 92 Q 77.5 99 70 99 L 14 99 Q 6.5 99 6 92 L 2 17 Q 3 7.5 12 6 Z";
// Cavidade rebaixada que da volume de concha plastica
const CAVITY_PATH =
  "M 15 13 Q 42 9 69 13 Q 74.5 14 75 21 L 71.5 86 Q 71 91 66 91 L 18 91 Q 13 91 12.5 86 L 9 21 Q 9.5 14 15 13 Z";
// Assento projetado com borda frontal grossa
const PAN_PATH =
  "M 4 97 Q 42 103 80 97 L 85 113 Q 85.5 119 79 120 Q 42 125 5 120 Q -1.5 119 -1 113 Z";
const LIP_HIGHLIGHT_PATH = "M 6 112 Q 42 117.5 78 112";
const GLOSS_PATH =
  "M 13 12 Q 22 9.5 30 9 L 26 80 Q 18 82 12.5 84 L 9 21 Q 9.5 13.5 13 12 Z";

function starPoints(cx: number, cy: number, outer: number): string {
  const inner = outer * 0.42;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

const STAR = starPoints(42, 22, 6.4);

// Escala tipografica: nomes curtos ganham presenca, longos encolhem sem quebrar
function nameFontSize(label: string): number {
  const len = label.length;
  if (len <= 4) return 15;
  if (len <= 6) return 13.5;
  if (len <= 8) return 12;
  if (len <= 10) return 10.5;
  return 9.5;
}

// Estimativa conservadora da largura do texto em caixa alta na Heineken Serif
function needsCompression(label: string, size: number): boolean {
  return label.length * size * 0.66 > NAME_MAX_W;
}

interface SeatProps {
  index: number;
  x: number;
  state: SeatState;
  label: string;
  photoThumb?: string | null;
  animating: boolean;
  ids: Record<string, string>;
}

function Seat({ index, x, state, label, photoThumb, animating, ids }: SeatProps) {
  const isEmpty = state === "empty";
  const fontSize = nameFontSize(label);
  const compress = needsCompression(label, fontSize);

  return (
    <g transform={`translate(${x} 4)`}>
      {/* Grupo interno: a animacao CSS mexe so aqui e nao apaga o translate */}
      <g className={animating ? "seat-animating" : undefined}>
      {/* Sombra de contato na viga */}
      <ellipse cx="42" cy="124" rx="40" ry="3.2" fill="#000" opacity="0.35" />

      <path d={PAN_PATH} fill={`url(#${ids.pan})`} />
      <path
        d={LIP_HIGHLIGHT_PATH}
        fill="none"
        stroke="#fff"
        strokeOpacity={isEmpty ? 0.18 : 0.42}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      <path d={BACKREST_PATH} fill={`url(#${ids.shell})`} />
      <path d={CAVITY_PATH} fill={`url(#${ids.cavity})`} />
      <path d={GLOSS_PATH} fill={`url(#${ids.gloss})`} />
      <path
        d="M 12 6.5 Q 42 1.6 72 6.5"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.5"
        strokeWidth="1.1"
        strokeLinecap="round"
      />

      <polygon
        points={STAR}
        fill="#E2001A"
        stroke="#7A000E"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />

      {/* Vidro fosco sobre bancos ainda sem dono: mesma forma, menos luz */}
      {isEmpty ? (
        <path d={BACKREST_PATH} fill="#002A10" opacity="0.42" />
      ) : null}

      {state === "user" ? (
        <g>
          {photoThumb ? (
            <>
              <clipPath id={`${ids.clip}-${index}`}>
                <circle cx="42" cy="54" r="17" />
              </clipPath>
              <image
                href={photoThumb}
                x="25"
                y="37"
                width="34"
                height="34"
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${ids.clip}-${index})`}
              />
            </>
          ) : (
            <g fill="#fff" opacity="0.92">
              <circle cx="42" cy="48" r="7" />
              <path d="M 29 68 Q 30 57 42 57 Q 54 57 55 68 Z" />
            </g>
          )}
          <circle cx="42" cy="54" r="17" fill="none" stroke="#fff" strokeWidth="1.8" />
          <text
            x="42"
            y="85"
            textAnchor="middle"
            fill="#fff"
            fontFamily='"Heineken Sans", system-ui, sans-serif'
            fontWeight="700"
            fontSize="9"
            letterSpacing="1.2"
          >
            VOCÊ
          </text>
        </g>
      ) : state === "filled" ? (
        <text
          x="42"
          y={58 + fontSize * 0.35}
          textAnchor="middle"
          fill="#fff"
          fontFamily='"Heineken Serif 18", Georgia, serif'
          fontWeight="700"
          fontSize={fontSize}
          letterSpacing="0.4"
          textLength={compress ? NAME_MAX_W : undefined}
          lengthAdjust={compress ? "spacingAndGlyphs" : undefined}
          style={{ paintOrder: "stroke" }}
          stroke="#003D14"
          strokeWidth="1.6"
          strokeOpacity="0.55"
        >
          {label}
        </text>
      ) : (
        <g opacity="0.85">
          <circle
            cx="42"
            cy="52"
            r="11"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.7"
            strokeWidth="1.3"
            strokeDasharray="3 2.6"
          />
          <path
            d="M 42 47 V 57 M 37 52 H 47"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <text
            x="42"
            y="78"
            textAnchor="middle"
            fill="#fff"
            fillOpacity="0.8"
            fontFamily='"Heineken Sans", system-ui, sans-serif'
            fontWeight="700"
            fontSize="8.5"
            letterSpacing="1"
          >
            {label}
          </text>
        </g>
      )}
      </g>
    </g>
  );
}

/** Cadeira vermelha cortada na borda, como na foto master */
function EdgeSeat({ side, ids }: { side: "left" | "right"; ids: Record<string, string> }) {
  const transform =
    side === "left"
      ? `translate(${ROW_X - SEAT_GAP - SEAT_W} 4)`
      : `translate(${VIEW_W - ROW_X + SEAT_GAP} 4)`;
  return (
    <g transform={transform} opacity="0.95">
      <path d={PAN_PATH} fill="#5E0009" />
      <path d={BACKREST_PATH} fill={`url(#${ids.red})`} />
      <path d={CAVITY_PATH} fill="#A3000F" opacity="0.55" />
    </g>
  );
}

export function ChairsPreview({
  mode,
  names = ["", "", ""],
  activeStep = 0,
  photoThumb,
}: ChairsPreviewProps) {
  const uid = useId().replace(/:/g, "");
  const ids = {
    shell: `shell-${uid}`,
    cavity: `cavity-${uid}`,
    pan: `pan-${uid}`,
    gloss: `gloss-${uid}`,
    red: `red-${uid}`,
    beam: `beam-${uid}`,
    clip: `clip-${uid}`,
  };

  const friends = names.map((n) => n?.trim().toUpperCase() || "");

  const seats = [0, 1, 2, 3].map((idx) => {
    if (idx === 0) return { state: "user" as SeatState, label: "VOCÊ" };
    const name = friends[idx - 1];
    const showName =
      mode === "names" ? Boolean(name) : mode === "waiting" ? Boolean(name) && idx <= activeStep : false;
    return showName
      ? { state: "filled" as SeatState, label: name }
      : { state: "empty" as SeatState, label: UX_COPY.seats.emptyLabel };
  });

  const ariaSummary =
    mode === "home"
      ? "Fileira de quatro bancos verdes de arquibancada: você no primeiro e três lugares guardados para seus amigos."
      : `Fileira de quatro bancos verdes: você no primeiro, depois ${seats
          .slice(1)
          .map((s) => (s.state === "filled" ? s.label : "lugar vazio"))
          .join(", ")}.`;

  return (
    <div
      role="img"
      aria-label={ariaSummary}
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background:
          "radial-gradient(120% 70% at 50% 0%, #0E3B1E 0%, #062814 55%, #021509 100%)",
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={ids.shell} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3BC45A" />
            <stop offset="45%" stopColor="#1E9A3B" />
            <stop offset="100%" stopColor="#0C6A26" />
          </linearGradient>
          <linearGradient id={ids.cavity} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2AAE49" />
            <stop offset="60%" stopColor="#168A33" />
            <stop offset="100%" stopColor="#0B5E22" />
          </linearGradient>
          <linearGradient id={ids.pan} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0A5A1F" />
            <stop offset="45%" stopColor="#23A443" />
            <stop offset="100%" stopColor="#0B6324" />
          </linearGradient>
          <linearGradient id={ids.gloss} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={ids.red} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D0182A" />
            <stop offset="100%" stopColor="#7E0812" />
          </linearGradient>
          <linearGradient id={ids.beam} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2B2F2C" />
            <stop offset="100%" stopColor="#0B0D0C" />
          </linearGradient>
        </defs>

        {/* Torcida desfocada ao fundo: so massa de cor, sem rostos */}
        <g opacity="0.22">
          {[18, 64, 112, 160, 206, 252, 300, 348, 392].map((cx, i) => (
            <ellipse
              key={cx}
              cx={cx}
              cy={i % 2 === 0 ? 16 : 22}
              rx="20"
              ry="28"
              fill={["#C8102E", "#F2F2F2", "#1B3F8F", "#C8102E", "#7FB7E6"][i % 5]}
            />
          ))}
        </g>

        <EdgeSeat side="left" ids={ids} />
        <EdgeSeat side="right" ids={ids} />

        {/* Viga de concreto que sustenta a fileira */}
        <rect x="0" y="128" width={VIEW_W} height="9" fill={`url(#${ids.beam})`} />
        <rect x="0" y="137" width={VIEW_W} height={VIEW_H - 137} fill="#050806" />

        {seats.map((seat, idx) => (
          <Seat
            key={idx}
            index={idx}
            x={ROW_X + idx * (SEAT_W + SEAT_GAP)}
            state={seat.state}
            label={seat.label}
            photoThumb={photoThumb}
            animating={mode === "waiting" && idx === activeStep}
            ids={ids}
          />
        ))}
      </svg>
    </div>
  );
}
