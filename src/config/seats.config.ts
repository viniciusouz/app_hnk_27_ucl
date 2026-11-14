export interface SeatCoordinate {
  index: 1 | 2 | 3 | 4;
  role: "user" | "friend";
  // Centro horizontal da area de texto no encosto (% da largura da imagem 1080px)
  xPct: number;
  // Limites fisicos horizontais do encosto verde (% da largura da imagem 1080px)
  chairBoundsXPct: [number, number];
  // Centro vertical da area limpa abaixo da estrela vermelha (% da altura da imagem 1350px)
  yPct: number;
  // Largura maxima permitida do nome (% da largura da imagem)
  maxWidthPct: number;
  // Altura maxima permitida do texto (% da altura da imagem)
  maxHeightPct: number;
  // Inclinacao leve opcional para acompanhar perspectiva
  rotationDeg: number;
}

export interface ImageLayoutConfig {
  width: number;
  height: number;
  seats: [SeatCoordinate, SeatCoordinate, SeatCoordinate, SeatCoordinate];
  footerTopPct: number;
}

// Coordenadas calibradas sobre public/pipeline/master.jpg (1080x1350)
// Estrelas vermelhas ficam em y ~ 56.5% a 59.5%; area limpa do encosto centrada em y = 63.4%
export const SEATS_LAYOUT_CONFIG: ImageLayoutConfig = {
  width: 1080,
  height: 1350,
  seats: [
    {
      index: 1,
      role: "user",
      xPct: 16.8,
      chairBoundsXPct: [7.3, 26.3],
      yPct: 63.4,
      maxWidthPct: 10.4,
      maxHeightPct: 2.25,
      rotationDeg: 0,
    },
    {
      index: 2,
      role: "friend",
      xPct: 38.9,
      chairBoundsXPct: [29.4, 48.4],
      yPct: 63.4,
      maxWidthPct: 10.4,
      maxHeightPct: 2.25,
      rotationDeg: 0,
    },
    {
      index: 3,
      role: "friend",
      xPct: 61.2,
      chairBoundsXPct: [51.7, 70.7],
      yPct: 63.4,
      maxWidthPct: 10.4,
      maxHeightPct: 2.25,
      rotationDeg: 0,
    },
    {
      index: 4,
      role: "friend",
      xPct: 83.1,
      chairBoundsXPct: [73.7, 92.6],
      yPct: 63.4,
      maxWidthPct: 10.4,
      maxHeightPct: 2.25,
      rotationDeg: 0,
    },
  ],
  footerTopPct: 75,
};
