"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CAMPAIGN_CONFIG } from "@/config/campaign.config";
import {
  HOME_HEADLINE_ROUTES,
  HomeHeadlineRouteKey,
  UX_COPY,
  WHATSAPP_COPY_ROUTES,
  WhatsAppRouteKey,
} from "@/config/copy.config";
import { JobErrorCode, JobStatus } from "@/lib/jobStore";
import { validatePersonName } from "@/lib/validation";
import { AppShell } from "./AppShell";
import { ChairsPreview } from "./ChairsPreview";

type FlowStep = "age" | "home" | "photo" | "names" | "waiting" | "result";

interface ArquibancadaFlowProps {
  initialRoute?: HomeHeadlineRouteKey;
  pitchMode?: boolean;
  inviterFromId?: string | null;
  inviterName?: string | null;
}

interface JobClientState {
  id: string;
  status: JobStatus;
  errorCode: JobErrorCode;
  names: [string, string, string];
  userName: string | null;
  requiresUserName: boolean;
  imageUrl: string | null;
  shareUrl: string;
}

const AGE_STORAGE_KEY = "hnk_ucl27_age_18_ok";

function fireAnonymousEvent(
  event: string,
  extra?: { jobId?: string; routeVariant?: string; channel?: string }
): void {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...extra }),
  }).catch(() => undefined);
}

async function compressImageToJpegBlob(
  source: HTMLVideoElement | Blob
): Promise<{ blob: Blob; previewUrl: string }> {
  let bitmapOrImg: ImageBitmap | HTMLImageElement | HTMLVideoElement;
  let width: number;
  let height: number;
  let objectUrlToRevoke: string | null = null;

  if (source instanceof Blob) {
    objectUrlToRevoke = URL.createObjectURL(source);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Erro ao carregar imagem"));
      img.src = objectUrlToRevoke!;
    });
    bitmapOrImg = img;
    width = img.naturalWidth || 1080;
    height = img.naturalHeight || 1080;
  } else {
    bitmapOrImg = source;
    width = source.videoWidth || 1080;
    height = source.videoHeight || 1080;
  }

  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    throw new Error("Canvas indisponivel");
  }
  ctx.drawImage(bitmapOrImg, 0, 0, targetW, targetH);
  if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar JPEG"))),
      "image/jpeg",
      0.88
    );
  });
  const previewUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { blob, previewUrl };
}

export function ArquibancadaFlow({
  initialRoute = "A",
  pitchMode = false,
  inviterFromId = null,
  inviterName = null,
}: ArquibancadaFlowProps) {
  const [step, setStep] = useState<FlowStep>("age");
  const [ageBlocked, setAgeBlocked] = useState(false);
  const [homeRoute, setHomeRoute] = useState<HomeHeadlineRouteKey>(initialRoute);

  // Foto + consentimento
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [uploadedSelfiePath, setUploadedSelfiePath] = useState<string | null>(
    null
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Nomes dos 3 amigos
  const [names, setNames] = useState<[string, string, string]>(["", "", ""]);
  const [fieldErrors, setFieldErrors] = useState<
    [string | null, string | null, string | null]
  >([null, null, null]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  // Espera e Job ativo
  const [job, setJob] = useState<JobClientState | null>(null);
  const [waitingIdx, setWaitingIdx] = useState(0);
  const [waitingError, setWaitingError] = useState<{
    message: string;
    backToPhoto: boolean;
  } | null>(null);

  // Resultado e Plano B
  const [fallbackUserName, setFallbackUserName] = useState("");
  const [fallbackNameError, setFallbackNameError] = useState<string | null>(
    null
  );
  const [savingUserName, setSavingUserName] = useState(false);
  const [optionalInviterInput, setOptionalInviterInput] = useState("");
  const [waRoute, setWaRoute] = useState<WhatsAppRouteKey>("convite");
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [redoConfirmOpen, setRedoConfirmOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    fireAnonymousEvent("app_opened", { routeVariant: initialRoute });
    if (inviterFromId) {
      fireAnonymousEvent("invite_accepted", { jobId: inviterFromId });
    }

    try {
      if (window.sessionStorage.getItem(AGE_STORAGE_KEY) === "1") {
        setStep("home");
      }
    } catch {
      // sessionStorage indisponivel
    }

    return () => {
      stopCameraStream();
    };
  }, [initialRoute, inviterFromId, stopCameraStream]);

  // Liga o stream ao elemento <video> quando a camera ao vivo abre
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [cameraActive]);

  // Rotacao de frases da tela Espera
  useEffect(() => {
    if (step !== "waiting" || waitingError) return;
    const timer = window.setInterval(() => {
      setWaitingIdx((prev) => (prev + 1) % 4);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [step, waitingError]);

  // Polling de status do pedido a cada 2s
  useEffect(() => {
    if (step !== "waiting" || !job?.id || waitingError) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(job.id)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) {
            setWaitingError({
              message: UX_COPY.errors.generationFailed,
              backToPhoto: false,
            });
          }
          return;
        }
        const data = (await res.json()) as JobClientState;
        if (cancelled) return;

        if (data.status === "done" || data.status === "done_fallback") {
          setJob(data);
          setStep("result");
          return;
        }

        if (data.status === "error") {
          if (
            data.errorCode === "no_face" ||
            data.errorCode === "model_refused"
          ) {
            setWaitingError({
              message: UX_COPY.errors.noFace,
              backToPhoto: true,
            });
          } else if (data.errorCode === "multiple_faces") {
            setWaitingError({
              message: UX_COPY.errors.multipleFaces,
              backToPhoto: true,
            });
          } else {
            setWaitingError({
              message: UX_COPY.errors.generationFailed,
              backToPhoto: false,
            });
          }
        }
      } catch {
        if (!cancelled) {
          setWaitingError({
            message: UX_COPY.errors.networkFailed,
            backToPhoto: false,
          });
        }
      }
    };

    const interval = window.setInterval(() => void poll(), 2000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [job?.id, step, waitingError]);

  const handleConfirmAge = () => {
    try {
      window.sessionStorage.setItem(AGE_STORAGE_KEY, "1");
    } catch {
      // ignora erro de storage
    }
    fireAnonymousEvent("age_confirmed");
    setAgeBlocked(false);
    setStep("home");
  };

  const handleDenyAge = () => {
    fireAnonymousEvent("age_denied");
    setAgeBlocked(true);
  };

  const processSelectedPhoto = async (source: Blob | HTMLVideoElement) => {
    setPhotoError(null);
    try {
      const { blob, previewUrl } = await compressImageToJpegBlob(source);

      // Verificacao opcional via FaceDetector nativo quando o navegador suportar
      const FaceDetectorCtor = (
        window as unknown as {
          FaceDetector?: new () => {
            detect: (img: ImageBitmapSource) => Promise<unknown[]>;
          };
        }
      ).FaceDetector;
      if (FaceDetectorCtor) {
        try {
          const detector = new FaceDetectorCtor();
          const bitmap = await createImageBitmap(blob);
          const faces = await detector.detect(bitmap);
          bitmap.close?.();
          if (faces.length > 1) {
            setPhotoError(UX_COPY.errors.multipleFaces);
            return;
          }
          if (faces.length === 0) {
            setPhotoError(UX_COPY.errors.noFace);
          }
        } catch {
          // FaceDetector falhou neste dispositivo; segue fluxo normalmente
        }
      }

      setPhotoBlob(blob);
      setPhotoPreviewUrl(previewUrl);
      setUploadedSelfiePath(null);
      stopCameraStream();
    } catch {
      setPhotoError("Não deu para carregar essa foto. Tente outra imagem.");
    }
  };

  const handleStartLiveSelfie = async () => {
    setPhotoError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraFileInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      cameraFileInputRef.current?.click();
    }
  };

  const handleCaptureFrame = async () => {
    if (!videoRef.current) return;
    await processSelectedPhoto(videoRef.current);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await processSelectedPhoto(file);
  };

  const handleContinueToNames = () => {
    if (!photoBlob) {
      setPhotoError("Escolha ou tire uma foto antes de continuar.");
      return;
    }
    if (!consentChecked) {
      setPhotoError(UX_COPY.errors.consentMissing);
      return;
    }
    setPhotoError(null);
    setStep("names");
  };

  const handleNameChange = (idx: 0 | 1 | 2, val: string) => {
    const next: [string, string, string] = [...names] as [
      string,
      string,
      string,
    ];
    next[idx] = val.slice(0, CAMPAIGN_CONFIG.limits.maxNameLength);
    setNames(next);

    const nextErrs: [string | null, string | null, string | null] = [
      ...fieldErrors,
    ] as [string | null, string | null, string | null];
    nextErrs[idx] = null;
    setFieldErrors(nextErrs);
    setSubmitError(null);
  };

  const submitJobFlow = async () => {
    if (!photoBlob || !consentChecked) {
      setStep("photo");
      return;
    }

    const nextFieldErrors: [string | null, string | null, string | null] = [
      null,
      null,
      null,
    ];
    const cleanList: [string, string, string] = ["", "", ""];
    let hasError = false;

    for (let i = 0; i < 3; i++) {
      const check = validatePersonName(names[i], i + 1);
      if (!check.valid) {
        nextFieldErrors[i] = check.message || UX_COPY.errors.blockedName;
        hasError = true;
      } else {
        cleanList[i] = check.cleaned;
      }
    }

    if (hasError) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setWaitingError(null);

    try {
      let currentSelfiePath = uploadedSelfiePath;

      if (!currentSelfiePath) {
        const upUrlRes = await fetch("/api/upload-url", { method: "POST" });
        if (!upUrlRes.ok) {
          throw new Error(UX_COPY.errors.networkFailed);
        }
        const upMeta = (await upUrlRes.json()) as {
          uploadUrl: string;
          selfiePath: string;
        };

        const putRes = await fetch(upMeta.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg" },
          body: photoBlob,
        });
        if (!putRes.ok) {
          const errJson = (await putRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(errJson?.error || UX_COPY.errors.networkFailed);
        }
        currentSelfiePath = upMeta.selfiePath;
        setUploadedSelfiePath(currentSelfiePath);
      }

      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfiePath: currentSelfiePath,
          names: cleanList,
          consent: true,
          inviterFromId: inviterFromId || undefined,
        }),
      });

      const jobData = (await jobRes.json().catch(() => null)) as
        | (JobClientState & {
            error?: string;
            fieldErrors?: Array<string | null>;
          })
        | null;

      if (!jobRes.ok || !jobData?.id) {
        if (jobData?.fieldErrors && jobData.fieldErrors.length === 3) {
          setFieldErrors([
            jobData.fieldErrors[0],
            jobData.fieldErrors[1],
            jobData.fieldErrors[2],
          ]);
        }
        setSubmitError(jobData?.error || UX_COPY.errors.generationFailed);
        return;
      }

      setJob(jobData);
      setWaitingIdx(0);
      setStep("waiting");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : UX_COPY.errors.networkFailed
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveUserName = async (
    nameToSave: string,
    isFallbackGate: boolean
  ) => {
    if (!job) return;
    const validation = validatePersonName(nameToSave);
    if (!validation.valid) {
      setFallbackNameError(validation.message || UX_COPY.errors.emptySelfName);
      return;
    }

    setSavingUserName(true);
    setFallbackNameError(null);
    try {
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(job.id)}/user-name`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userName: validation.cleaned }),
        }
      );
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        userName?: string;
        imageUrl?: string | null;
        error?: string;
      } | null;

      if (!res.ok || !data?.ok) {
        setFallbackNameError(data?.error || UX_COPY.errors.blockedName);
        return;
      }

      setJob((prev) =>
        prev
          ? {
              ...prev,
              userName: data.userName || validation.cleaned,
              requiresUserName: false,
              imageUrl: data.imageUrl || prev.imageUrl,
            }
          : prev
      );
      if (!isFallbackGate) {
        setShareFeedback("Nome salvo no link de convite.");
      }
    } catch {
      setFallbackNameError(UX_COPY.errors.networkFailed);
    } finally {
      setSavingUserName(false);
    }
  };

  const shareAbsoluteUrl = useMemo(() => {
    if (!job?.shareUrl) return "";
    if (typeof window === "undefined") return job.shareUrl;
    return `${window.location.origin}${job.shareUrl}`;
  }, [job?.shareUrl]);

  const handleShareFriends = async () => {
    if (!job) return;
    setShareFeedback(null);
    const link = shareAbsoluteUrl;
    const text = WHATSAPP_COPY_ROUTES[waRoute].template(link);

    fireAnonymousEvent("share_clicked", { jobId: job.id, channel: waRoute });

    // Caminho principal: Web Share API com arquivo anexado quando suportado
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      job.imageUrl
    ) {
      try {
        const imgRes = await fetch(job.imageUrl);
        if (imgRes.ok) {
          const blob = await imgRes.blob();
          const file = new File(
            [blob],
            "arquibancada-heineken-ucl-2027.jpg",
            { type: "image/jpeg" }
          );
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: UX_COPY.brandSignature,
              text,
            });
            return;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        // Continua para o link de WhatsApp caso o aparelho recuse files
      }
    }

    // Fallback garantido: wa.me/?text=... com mensagem e link /s/[id]
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    setShareFeedback("Convite pronto para enviar no WhatsApp.");
  };

  const handleCopyShareLink = async () => {
    if (!shareAbsoluteUrl) return;
    const fullMessage = WHATSAPP_COPY_ROUTES[waRoute].template(shareAbsoluteUrl);
    try {
      await navigator.clipboard.writeText(fullMessage);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setShareFeedback(shareAbsoluteUrl);
    }
  };

  const handleDownloadImage = () => {
    if (!job?.imageUrl) return;
    fireAnonymousEvent("download_clicked", { jobId: job.id });
    const sep = job.imageUrl.includes("?") ? "&" : "?";
    const anchor = document.createElement("a");
    anchor.href = `${job.imageUrl}${sep}download=1`;
    anchor.download = "arquibancada-heineken-ucl-2027.jpg";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleConfirmRedoPhoto = async () => {
    if (job?.id) {
      await fetch(`/api/jobs/${encodeURIComponent(job.id)}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
    setRedoConfirmOpen(false);
    setJob(null);
    setPhotoBlob(null);
    setPhotoPreviewUrl(null);
    setUploadedSelfiePath(null);
    setConsentChecked(false);
    setFallbackUserName("");
    setFallbackNameError(null);
    setWaitingError(null);
    setShareFeedback(null);
    setStep("photo");
  };

  // Tela 01: Barreira de Idade 18+
  if (step === "age") {
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
            paddingBlock: 12,
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
                  onClick={handleConfirmAge}
                >
                  {UX_COPY.ageGate.confirmButton}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDenyAge}
                >
                  {UX_COPY.ageGate.denyButton}
                </button>
              </div>
            </>
          ) : (
            <div
              className="surface-card"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: 20,
              }}
            >
              <h1 className="type-title">{UX_COPY.ageGate.blockedTitle}</h1>
              <p className="type-body" style={{ color: "#FFFFFF" }}>
                {UX_COPY.ageGate.blockedMessage}
              </p>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  // Tela 02: Home
  if (step === "home") {
    const activeRoute = HOME_HEADLINE_ROUTES[homeRoute];
    return (
      <AppShell>
        <div
          className="screen-enter"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {inviterFromId ? (
            <div
              className="surface-card"
              style={{
                padding: "10px 14px",
                borderLeft: "4px solid #D10003",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: "18px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                }}
              >
                {inviterName
                  ? UX_COPY.invite.titleWithName(inviterName)
                  : UX_COPY.invite.titleAnonymous}
              </p>
            </div>
          ) : null}

          <ChairsPreview mode="home" />

          {pitchMode ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
              aria-label="Seletor de rota de titulo para apresentacao"
            >
              {(["A", "B", "C"] as const).map((key) => {
                const selected = homeRoute === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setHomeRoute(key)}
                    style={{
                      minHeight: 44,
                      padding: "6px 14px",
                      borderRadius: 22,
                      border: "1px solid rgba(255,255,255,0.55)",
                      background: selected ? "#FFFFFF" : "rgba(0, 95, 42, 0.6)",
                      color: selected ? "#007118" : "#FFFFFF",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Rota {key}: {HOME_HEADLINE_ROUTES[key].label}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 className="type-display">{activeRoute.title}</h1>
            <p className="type-body">{UX_COPY.home.support}</p>
          </div>

          <ol
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {UX_COPY.home.steps.map((label, idx) => (
              <li
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    background: "#FFFFFF",
                    color: "#007118",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ol>

          <div style={{ flex: 1 }} />

          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setPhotoError(null);
              setStep("photo");
            }}
          >
            {UX_COPY.home.cta}
          </button>
        </div>
      </AppShell>
    );
  }

  // Tela 03: Foto (Passo 1 de 3)
  if (step === "photo") {
    return (
      <AppShell
        step={1}
        onBack={() => {
          stopCameraStream();
          setStep("home");
        }}
      >
        <div
          className="screen-enter"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 className="type-title" style={{ fontSize: 28, lineHeight: "32px" }}>
              {UX_COPY.photo.title}
            </h1>
            <p className="type-body">{UX_COPY.photo.support}</p>
          </div>

          {/* Inputs ocultos para captura nativa ou galeria */}
          <input
            ref={cameraFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="user"
            onChange={handleFileChange}
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              overflow: "hidden",
              pointerEvents: "none",
            }}
            aria-label="Selecionar foto pela câmera"
          />
          <input
            ref={galleryFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              overflow: "hidden",
              pointerEvents: "none",
            }}
            aria-label="Escolher foto da galeria"
          />

          <div
            className="surface-card"
            style={{
              height: 256,
              padding: 0,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                  }}
                />
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    width: 146,
                    height: 186,
                    borderRadius: "50%",
                    border: "2px dashed rgba(255,255,255,0.92)",
                    boxShadow: "0 0 0 999px rgba(0, 48, 18, 0.35)",
                    pointerEvents: "none",
                  }}
                />
              </>
            ) : photoPreviewUrl ? (
              <img
                src={photoPreviewUrl}
                alt="Prévia da sua foto selecionada"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <>
                <div
                  aria-hidden="true"
                  style={{
                    width: 134,
                    height: 174,
                    borderRadius: "50%",
                    border: "2px dashed rgba(255,255,255,0.85)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.75)"
                    strokeWidth="1.6"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: "#E8F5EB",
                    textAlign: "center",
                    paddingInline: 16,
                  }}
                >
                  {UX_COPY.photo.cameraPlaceholder}
                </span>
              </>
            )}
          </div>

          {photoError ? (
            <div className="error-banner" role="alert">
              {photoError}
            </div>
          ) : null}

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              fontSize: 13,
              lineHeight: "19px",
              color: "#FFFFFF",
              cursor: "pointer",
              paddingBlock: 4,
            }}
          >
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => {
                setConsentChecked(e.target.checked);
                if (e.target.checked && photoError === UX_COPY.errors.consentMissing) {
                  setPhotoError(null);
                }
              }}
              style={{
                width: 24,
                height: 24,
                minWidth: 24,
                minHeight: 24,
                margin: 0,
                accentColor: "#FFFFFF",
                cursor: "pointer",
              }}
            />
            <span>{UX_COPY.photo.consentText}</span>
          </label>

          <div style={{ flex: 1 }} />

          {cameraActive ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCaptureFrame}
              >
                {UX_COPY.photo.captureNowButton}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={stopCameraStream}
              >
                Cancelar câmera
              </button>
            </div>
          ) : photoPreviewUrl ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="btn-primary"
                disabled={!consentChecked}
                onClick={handleContinueToNames}
              >
                {UX_COPY.photo.continueButton}
              </button>
              {!consentChecked ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    textAlign: "center",
                    color: "#E8F5EB",
                  }}
                >
                  {UX_COPY.photo.consentRequiredHint}
                </p>
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setPhotoBlob(null);
                  setPhotoPreviewUrl(null);
                  setUploadedSelfiePath(null);
                  setPhotoError(null);
                }}
              >
                {UX_COPY.photo.changePhotoButton}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartLiveSelfie}
              >
                {UX_COPY.photo.selfieButton}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => galleryFileInputRef.current?.click()}
              >
                {UX_COPY.photo.galleryButton}
              </button>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  // Tela 04: Nomes (Passo 2 de 3)
  if (step === "names") {
    const hasAnyName = names.some((n) => n.trim().length > 0);

    return (
      <AppShell
        step={2}
        onBack={() => {
          if (hasAnyName) {
            setLeaveConfirmOpen(true);
          } else {
            setStep("photo");
          }
        }}
      >
        <div
          className="screen-enter"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 className="type-title" style={{ fontSize: 28, lineHeight: "32px" }}>
              {UX_COPY.names.title}
            </h1>
            <p className="type-body">{UX_COPY.names.support}</p>
          </div>

          <ChairsPreview
            mode="names"
            names={names}
            photoThumb={photoPreviewUrl}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitJobFlow();
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              flex: 1,
            }}
          >
            {([0, 1, 2] as const).map((idx) => (
              <div
                key={idx}
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <label
                  htmlFor={`friend-name-${idx}`}
                  className="type-label"
                  style={{ color: "#FFFFFF" }}
                >
                  {UX_COPY.names.fieldLabels[idx]}
                </label>
                <input
                  id={`friend-name-${idx}`}
                  type="text"
                  maxLength={CAMPAIGN_CONFIG.limits.maxNameLength}
                  autoComplete="off"
                  placeholder={UX_COPY.names.placeholder}
                  value={names[idx]}
                  onChange={(e) => handleNameChange(idx, e.target.value)}
                  className={`field-input ${fieldErrors[idx] ? "has-error" : ""}`}
                />
                {fieldErrors[idx] ? (
                  <span
                    role="alert"
                    style={{ fontSize: 12, lineHeight: "16px", color: "#FFFFFF" }}
                  >
                    {fieldErrors[idx]}
                  </span>
                ) : null}
              </div>
            ))}

            <p style={{ margin: 0, fontSize: 12, color: "#E8F5EB" }}>
              {UX_COPY.names.help}
            </p>

            {submitError ? (
              <div className="error-banner" role="alert">
                {submitError}
              </div>
            ) : null}

            <div style={{ flex: 1 }} />

            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Enviando..." : UX_COPY.names.cta}
            </button>
          </form>
        </div>

        {leaveConfirmOpen ? (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-modal-title"
          >
            <div className="modal-card">
              <h2 id="leave-modal-title" className="type-title">
                {UX_COPY.confirmations.leaveFlow.title}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setLeaveConfirmOpen(false)}
                >
                  {UX_COPY.confirmations.leaveFlow.cancel}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setLeaveConfirmOpen(false);
                    setStep("photo");
                  }}
                >
                  {UX_COPY.confirmations.leaveFlow.confirm}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </AppShell>
    );
  }

  // Tela 05: Espera (Passo 3 de 3)
  if (step === "waiting") {
    const rotatingList = UX_COPY.waiting.rotatingMessages;
    const currentMessage =
      rotatingList[waitingIdx % rotatingList.length] || rotatingList[0];

    return (
      <AppShell step={3}>
        <div
          className="screen-enter"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 22,
          }}
        >
          <ChairsPreview
            mode="waiting"
            names={job?.names || names}
            activeStep={waitingIdx % 4}
            photoThumb={photoPreviewUrl}
          />

          {waitingError ? (
            <div
              className="error-banner"
              role="alert"
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {waitingError.message}
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (waitingError.backToPhoto) {
                    setWaitingError(null);
                    setUploadedSelfiePath(null);
                    setStep("photo");
                  } else {
                    setWaitingError(null);
                    void submitJobFlow();
                  }
                }}
              >
                {UX_COPY.waiting.retryButton}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <h1
                  className="type-title"
                  style={{ fontSize: 28, lineHeight: "34px" }}
                >
                  {currentMessage}
                </h1>
                <div
                  role="progressbar"
                  aria-label="Andamento da imagem"
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: "#005F2A",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${28 + ((waitingIdx % 3) + 1) * 22}%`,
                      height: "100%",
                      borderRadius: 4,
                      background: "#FFFFFF",
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
                <p className="type-body" style={{ fontSize: 13 }}>
                  {UX_COPY.waiting.support}
                </p>
              </div>
            </>
          )}
        </div>
      </AppShell>
    );
  }

  // Tela 06: Resultado (com fluxo enxuto do Plano B para gravar nome na cadeira 1)
  if (job?.requiresUserName) {
    return (
      <AppShell>
        <div
          className="screen-enter"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <ChairsPreview
            mode="names"
            names={job.names}
            photoThumb={photoPreviewUrl}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 className="type-title" style={{ fontSize: 28, lineHeight: "33px" }}>
              {UX_COPY.result.fallbackNameTitle}
            </h1>
            <p className="type-body">{UX_COPY.result.fallbackNameSupport}</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveUserName(fallbackUserName, true);
            }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label htmlFor="fallback-user-name" className="type-label">
                {UX_COPY.result.fallbackNameLabel}
              </label>
              <input
                id="fallback-user-name"
                type="text"
                maxLength={CAMPAIGN_CONFIG.limits.maxNameLength}
                autoComplete="given-name"
                placeholder={UX_COPY.names.placeholder}
                value={fallbackUserName}
                onChange={(e) => {
                  setFallbackUserName(
                    e.target.value.slice(0, CAMPAIGN_CONFIG.limits.maxNameLength)
                  );
                  setFallbackNameError(null);
                }}
                className={`field-input ${fallbackNameError ? "has-error" : ""}`}
              />
              {fallbackNameError ? (
                <span role="alert" style={{ fontSize: 12, color: "#FFFFFF" }}>
                  {fallbackNameError}
                </span>
              ) : null}
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={savingUserName}
            >
              {savingUserName
                ? "Gravando..."
                : UX_COPY.result.fallbackNameButton}
            </button>
          </form>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div
        className="screen-enter"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h1 className="type-title">{UX_COPY.result.title}</h1>

        {job?.imageUrl ? (
          <div
            style={{
              alignSelf: "center",
              width: "100%",
              maxWidth: 278,
              aspectRatio: "4 / 5",
              borderRadius: 16,
              overflow: "hidden",
              border: "1.5px solid rgba(255,255,255,0.45)",
              background: "#005F2A",
              boxShadow: "0 14px 32px rgba(0, 32, 10, 0.38)",
            }}
          >
            <img
              src={job.imageUrl}
              alt={`Arquibancada na final da Champions com ${
                job.userName || "você"
              } e os nomes ${job.names.join(", ")}.`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        ) : null}

        {/* Se o fluxo veio da IA sem pedir nome antes, permite assinar o link do convite */}
        {job?.status === "done" && !job.userName ? (
          <div
            className="surface-card"
            style={{
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              type="text"
              maxLength={CAMPAIGN_CONFIG.limits.maxNameLength}
              aria-label={UX_COPY.result.optionalInviterLabel}
              placeholder={`${UX_COPY.result.optionalInviterLabel} (${UX_COPY.result.optionalInviterPlaceholder})`}
              value={optionalInviterInput}
              onChange={(e) => {
                setOptionalInviterInput(
                  e.target.value.slice(0, CAMPAIGN_CONFIG.limits.maxNameLength)
                );
                setFallbackNameError(null);
              }}
              className="field-input"
              style={{ minHeight: 44, fontSize: 14, flex: 1 }}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={savingUserName || !optionalInviterInput.trim()}
              onClick={() => void handleSaveUserName(optionalInviterInput, false)}
              style={{ width: "auto", minHeight: 44, paddingInline: 14, fontSize: 13 }}
            >
              OK
            </button>
          </div>
        ) : null}

        {/* 3 rotas de mensagem do WhatsApp */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["convite", "provocacao", "combinado"] as const).map((key) => {
              const selected = waRoute === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setWaRoute(key)}
                  style={{
                    minHeight: 44,
                    padding: "6px 12px",
                    borderRadius: 22,
                    border: "1px solid rgba(255,255,255,0.5)",
                    background: selected ? "#FFFFFF" : "rgba(0,95,42,0.7)",
                    color: selected ? "#007118" : "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {WHATSAPP_COPY_ROUTES[key].label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void handleCopyShareLink()}
            style={{
              minHeight: 44,
              padding: "6px 12px",
              borderRadius: 22,
              border: "1px solid rgba(255,255,255,0.5)",
              background: "transparent",
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {copiedLink
              ? UX_COPY.result.copiedLinkFeedback
              : UX_COPY.result.copyLinkButton}
          </button>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => void handleShareFriends()}
        >
          {UX_COPY.result.primaryCta}
        </button>

        {shareFeedback ? (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              textAlign: "center",
              color: "#E8F5EB",
            }}
          >
            {shareFeedback}
          </p>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleDownloadImage}
            style={{ minHeight: 46, fontSize: 14 }}
          >
            {UX_COPY.result.downloadButton}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setRedoConfirmOpen(true)}
            style={{ minHeight: 46, fontSize: 14 }}
          >
            {UX_COPY.result.redoButton}
          </button>
        </div>

        {/* Clube Heineken como link de cadastro, sempre com "concorrer" */}
        <div
          className="surface-card"
          style={{
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
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
              lineHeight: "22px",
              display: "inline-block",
              paddingBlock: 2,
            }}
          >
            {UX_COPY.result.promoLink}
          </a>
        </div>
      </div>

      {redoConfirmOpen ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="redo-modal-title"
        >
          <div className="modal-card">
            <h2 id="redo-modal-title" className="type-title">
              {UX_COPY.confirmations.redoPhoto.title}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setRedoConfirmOpen(false)}
              >
                {UX_COPY.confirmations.redoPhoto.cancel}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleConfirmRedoPhoto()}
              >
                {UX_COPY.confirmations.redoPhoto.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
