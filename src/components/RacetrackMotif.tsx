import React from "react";

// Caminho vetorial exato do Racetrack oficial (Heineken_Brand_Racetrack_Logo_RGB.svg)
// Sempre vertical (nunca girado, nunca esticado, mostrando 2 curvas na borda sem cortar em 50%).
export function RacetrackMotif() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      {/* Racetrack cortado superior direito exibindo as 2 curvas inferiores sem dividir em arco de 50% */}
      <svg
        viewBox="84 80 273 340"
        style={{
          position: "absolute",
          top: "-155px",
          right: "-95px",
          width: "260px",
          height: "auto",
          opacity: 0.48,
        }}
      >
        <path
          d="M220.48,80.26c-75.13,0-136.25,55.33-136.25,123.33v92.08c0,68.01,61.12,123.33,136.25,123.33c75.13,0,136.25-55.33,136.25-123.33v-92.08C356.73,135.58,295.61,80.26,220.48,80.26Z"
          fill="#268913"
        />
        <path
          d="M220.48,108c-59.5,0-108,43.8-108,97.5v88.8c0,53.7,48.5,97.5,108,97.5s108-43.8,108-97.5v-88.8C328.48,151.8,279.98,108,220.48,108Z"
          fill="#005F2A"
        />
      </svg>

      {/* Segundo recorte vertical discreto na base esquerda mantendo proporcao oficial */}
      <svg
        viewBox="84 80 273 340"
        style={{
          position: "absolute",
          bottom: "-180px",
          left: "-125px",
          width: "250px",
          height: "auto",
          opacity: 0.36,
        }}
      >
        <path
          d="M220.48,80.26c-75.13,0-136.25,55.33-136.25,123.33v92.08c0,68.01,61.12,123.33,136.25,123.33c75.13,0,136.25-55.33,136.25-123.33v-92.08C356.73,135.58,295.61,80.26,220.48,80.26Z"
          fill="#005F2A"
        />
      </svg>
    </div>
  );
}
