import { BLOCKED_TERMS } from "@/config/blocklist.config";
import { CAMPAIGN_CONFIG } from "@/config/campaign.config";
import { UX_COPY } from "@/config/copy.config";

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
};

export function normalizeForModeration(input: string): string {
  const noAccents = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  let unleet = "";
  for (const ch of noAccents) {
    unleet += LEET_MAP[ch] ?? ch;
  }

  return unleet.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function sanitizePersonName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export interface NameValidationResult {
  valid: boolean;
  cleaned: string;
  code?: "empty" | "too_long" | "invalid_chars" | "blocked_name";
  message?: string;
}

const VALID_NAME_REGEX = /^[\p{L}][\p{L}\s-]*$/u;

export function validatePersonName(
  raw: string,
  friendNumber?: number
): NameValidationResult {
  const cleaned = sanitizePersonName(raw);

  if (!cleaned) {
    return {
      valid: false,
      cleaned,
      code: "empty",
      message: friendNumber
        ? UX_COPY.errors.emptyFriend(friendNumber)
        : UX_COPY.errors.emptySelfName,
    };
  }

  if (cleaned.length > CAMPAIGN_CONFIG.limits.maxNameLength) {
    return {
      valid: false,
      cleaned,
      code: "too_long",
      message: `Use até ${CAMPAIGN_CONFIG.limits.maxNameLength} letras.`,
    };
  }

  // Bloqueia links explicitos ou termos proibidos antes mesmo do regex de letras
  const normalized = normalizeForModeration(cleaned);
  const compact = normalized.replace(/\s+/g, "");
  const tokens = normalized.split(" ").filter(Boolean);

  for (const term of BLOCKED_TERMS) {
    const cleanTerm = normalizeForModeration(term).replace(/\s+/g, "");
    if (!cleanTerm) continue;
    if (
      tokens.includes(cleanTerm) ||
      compact === cleanTerm ||
      (cleanTerm.length >= 4 && compact.includes(cleanTerm))
    ) {
      return {
        valid: false,
        cleaned,
        code: "blocked_name",
        message: UX_COPY.errors.blockedName,
      };
    }
  }

  if (!VALID_NAME_REGEX.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      code: "invalid_chars",
      message: UX_COPY.errors.blockedName,
    };
  }

  return {
    valid: true,
    cleaned,
  };
}
