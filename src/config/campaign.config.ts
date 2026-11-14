export interface CampaignConfig {
  campaignName: string;
  campaignTagline: string;
  cityFinal: string;
  year: number;
  clubeHeinekenUrl: string;
  regulamentoSummary: {
    title: string;
    paragraphs: string[];
  };
  assets: {
    masterImage: string;
    fallbackImage: string;
    jerseyImage: string;
    logoHorizontalOnGreen: string;
    logoExtHorizOnGreen: string;
    racetrackLogo: string;
  };
  limits: {
    maxNameLength: number;
    maxUploadBytes: number;
    jobTtlHours: number;
    aiTimeoutMs: number;
    maxPerDevicePerDay: number;
    maxGlobalPerDay: number;
  };
}

export const CAMPAIGN_CONFIG: CampaignConfig = {
  campaignName: "Mais Amigos, Mais Champions.",
  campaignTagline: "Quanto mais amigos, mais Champions.",
  cityFinal: "Madri",
  year: 2027,
  clubeHeinekenUrl:
    process.env.NEXT_PUBLIC_CLUBE_HEINEKEN_URL ||
    "https://clube.heineken.com.br/",
  regulamentoSummary: {
    title: "Regras de uso e privacidade",
    paragraphs: [
      "Experiência digital exclusiva para maiores de 18 anos. Não compartilhe este conteúdo nem os links gerados com menores de idade.",
      "A imagem criada na arquibancada é uma simulação ilustrativa entre amigos e não constitui ingresso, voucher ou garantia de premiação.",
      "Para concorrer aos ingressos de verdade da final em Madri, realize o cadastro no Clube Heineken e consulte o regulamento oficial da promoção.",
      "Privacidade (LGPD): sua foto é usada apenas para compor esta imagem. Tanto a foto enviada quanto a arte final são apagadas automaticamente em até 24 horas.",
    ],
  },
  assets: {
    masterImage: "public/pipeline/master.jpg",
    fallbackImage: "public/pipeline/fallback.jpg",
    jerseyImage: "public/pipeline/camisa.png",
    logoHorizontalOnGreen: "public/brand/heineken-logo-horiz-on-green.svg",
    logoExtHorizOnGreen: "public/brand/heineken-logo-exthoriz-on-green.svg",
    racetrackLogo: "public/brand/heineken-racetrack-rgb.svg",
  },
  limits: {
    maxNameLength: 12,
    maxUploadBytes: 8 * 1024 * 1024,
    jobTtlHours: 24,
    aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 90_000),
    maxPerDevicePerDay: Number(process.env.MAX_GENERATIONS_PER_DEVICE_PER_DAY || 5),
    maxGlobalPerDay: Number(process.env.MAX_GLOBAL_GENERATIONS_PER_DAY || 500),
  },
};
