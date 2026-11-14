export type HomeHeadlineRouteKey = "A" | "B" | "C";
export type WhatsAppRouteKey = "convite" | "provocacao" | "combinado";

export const HOME_HEADLINE_ROUTES: Record<
  HomeHeadlineRouteKey,
  { id: HomeHeadlineRouteKey; label: string; title: string; subtitle: string }
> = {
  A: {
    id: "A",
    label: "Esperado",
    title: "Guarde o lugar dos seus amigos na final.",
    subtitle: "Explica a mecânica em uma linha.",
  },
  B: {
    id: "B",
    label: "Surpreendente",
    title: "Tem 3 cadeiras vazias do seu lado.",
    subtitle: "Cria a tensão que a imagem resolve.",
  },
  C: {
    id: "C",
    label: "Disruptivo",
    title: "Final sem amigo é só um jogo.",
    subtitle: "Vende o conceito antes da ferramenta.",
  },
};

export const WHATSAPP_COPY_ROUTES: Record<
  WhatsAppRouteKey,
  { id: WhatsAppRouteKey; label: string; template: (link: string) => string }
> = {
  convite: {
    id: "convite",
    label: "Convite",
    template: (link: string) =>
      `Guardei seu lugar na final da Champions. Agora é com você: entra aqui e me escala no seu time. ${link}`,
  },
  provocacao: {
    id: "provocacao",
    label: "Provocação",
    template: (link: string) =>
      `Olha quem já está sentado na final. Sua cadeira tem nome, falta você aparecer. ${link}`,
  },
  combinado: {
    id: "combinado",
    label: "Cobrança",
    template: (link: string) =>
      `Se eu ganhar, te levo. Se você ganhar, lembra de mim. Combinado? ${link}`,
  },
};

export const UX_COPY = {
  brandSignature: "Mais Amigos, Mais Champions",
  ageGate: {
    badge: "18+",
    title: "Você tem 18 anos ou mais?",
    support:
      "Esta experiência é de uma marca de cerveja e só pode ser acessada por maiores de idade.",
    confirmButton: "Tenho 18+",
    denyButton: "Ainda não",
    blockedTitle: "Acesso restrito a maiores de 18 anos",
    blockedMessage:
      "Essa resenha é só para maiores de 18. A gente se vê daqui a pouco.",
  },
  home: {
    support:
      "Tire uma foto, escale 3 amigos e mande o convite. Quanto mais amigos, mais Champions.",
    steps: [
      "Sua selfie",
      "O nome de 3 amigos",
      "Convite pronto para o WhatsApp",
    ],
    cta: "Sentar na arquibancada",
  },
  photo: {
    stepLabel: "Passo 1 de 3",
    title: "Primeiro, você.",
    support: "Rosto de frente, boa luz, só você na foto.",
    cameraPlaceholder: "Posicione seu rosto no guia oval",
    selfieButton: "Tirar selfie",
    captureNowButton: "Capturar foto",
    galleryButton: "Escolher da galeria",
    changePhotoButton: "Trocar foto",
    continueButton: "Avançar para os nomes",
    consentText:
      "Autorizo o uso da minha foto para criar esta imagem. Ela é apagada em 24 horas.",
    consentRequiredHint:
      "Marque a autorização acima para usar sua foto na imagem.",
  },
  names: {
    stepLabel: "Passo 2 de 3",
    title: "Quem vai com você?",
    support: "Só o primeiro nome. Cada um ganha uma cadeira ao seu lado.",
    fieldLabels: ["Amigo 1", "Amigo 2", "Amigo 3"],
    placeholder: "Primeiro nome",
    help: "Até 12 letras por nome.",
    cta: "Escalar meu time",
  },
  waiting: {
    stepLabel: "Passo 3 de 3",
    rotatingMessages: [
      "Achando seu lugar na arquibancada...",
      "Vestindo a camisa...",
      "Guardando 3 cadeiras...",
    ],
    support: "Leva menos de 1 minuto. Não feche esta tela.",
    retryButton: "Tentar de novo",
  },
  result: {
    title: "Seu lugar está guardado. Faltam eles.",
    fallbackNameTitle: "Falta colocar o seu nome na cadeira 1.",
    fallbackNameSupport:
      "A arquibancada lotou de torcida agora. Digite seu primeiro nome para gravar os 4 lugares juntos.",
    fallbackNameLabel: "Seu nome",
    fallbackNameButton: "Mostrar minha arquibancada",
    optionalInviterLabel: "Seu nome no convite (opcional)",
    optionalInviterPlaceholder: "Ex.: Vini",
    optionalInviterButton: "Atualizar convite",
    primaryCta: "Chamar meus amigos",
    copyLinkButton: "Copiar link",
    copiedLinkFeedback: "Link copiado",
    downloadButton: "Baixar imagem",
    redoButton: "Refazer foto",
    promoText: "Quer concorrer aos ingressos de verdade?",
    promoLink: "Cadastre-se no Clube Heineken.",
  },
  invite: {
    eyebrow: "Você foi escalado",
    titleWithName: (name: string) => `${name} guardou um lugar para você.`,
    titleAnonymous: "Guardaram um lugar para você na final.",
    support: "Monte sua arquibancada e escale quem vai com você.",
    cta: "Montar a minha",
    expiredTitle: "Essa arquibancada já esvaziou.",
    expiredMessage: "Essa arquibancada já esvaziou. Monte a sua.",
  },
  confirmations: {
    redoPhoto: {
      title: "Refazer a foto? A imagem atual será apagada.",
      confirm: "Refazer",
      cancel: "Manter esta",
    },
    leaveFlow: {
      title: "Sair agora? Seus amigos ficam sem lugar.",
      confirm: "Sair",
      cancel: "Continuar",
    },
  },
  errors: {
    noFace: "Não deu para ver seu rosto. Tente de frente e com mais luz.",
    multipleFaces: "Essa cadeira é só sua. Mande uma foto sozinho.",
    blockedName: "Esse nome não entra em campo. Tente outro.",
    emptyFriend: (num: number) => `Falta escalar o amigo ${num}.`,
    emptySelfName: "Digite seu primeiro nome (até 12 letras).",
    generationFailed: "A arquibancada lotou. Tente de novo em instantes.",
    networkFailed: "Caiu o sinal. Confira sua internet e tente de novo.",
    rateLimited:
      "Muitas escalações por hoje neste aparelho. Volte mais tarde para criar novas arquibancadas.",
    consentMissing:
      "Autorize o uso temporário da sua foto antes de continuar.",
  },
  footer: {
    legalPrefix: "Beba com moderação. Não compartilhe com menores de 18 anos.",
    legalLink: "Consulte o regulamento.",
    imageDisclaimer: "Imagem ilustrativa.",
  },
} as const;
