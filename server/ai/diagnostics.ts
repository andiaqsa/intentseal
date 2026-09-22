import { ApiError as GeminiApiError } from "@google/genai";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";

import {
  getConfiguredAiModel,
  getConfiguredAiProvider,
  isConfiguredProviderKeyPresent,
} from "./config";

type ServerEnvironment = Record<string, string | undefined>;

export type AiFailureCategory =
  | "aborted"
  | "authentication"
  | "bad_request"
  | "model_not_found"
  | "network"
  | "permission"
  | "provider"
  | "rate_limit"
  | "timeout"
  | "unknown";

export interface SafeAiFailureDiagnostic {
  name: string;
  provider: string | null;
  status: number | null;
  code: string | null;
  type: string | null;
  requestId: string | null;
  apiKeyConfigured: boolean;
  model: string | null;
  category: AiFailureCategory;
  localMessage?: string | null;
  localLocation?: string | null;
}

export function summarizeAiProviderFailure(
  error: unknown,
  environment: ServerEnvironment = process.env,
): SafeAiFailureDiagnostic {
  const openAiError = error instanceof APIError ? error : null;
  const geminiError = error instanceof GeminiApiError ? error : null;
  const geminiMetadata = readGeminiMetadata(geminiError);
  const status = openAiError?.status ?? geminiError?.status ?? null;
  const secrets = [environment.AI_API_KEY, environment.GEMINI_API_KEY];
  const code = safeMetadata(openAiError?.code ?? geminiMetadata.code, secrets);
  const type = safeMetadata(openAiError?.type ?? geminiMetadata.type, secrets);

  const diagnostic: SafeAiFailureDiagnostic = {
    name: safeErrorName(error),
    provider: safeConfigurationValue(getConfiguredAiProvider(environment), secrets),
    status: typeof status === "number" && Number.isFinite(status) ? status : null,
    code,
    type,
    requestId: safeMetadata(openAiError?.requestID, secrets),
    apiKeyConfigured: isConfiguredProviderKeyPresent(environment),
    model: safeConfigurationValue(getConfiguredAiModel(environment), secrets),
    category: classifyFailure(error, status, code, type),
  };

  if (error instanceof TypeError && environment.NODE_ENV !== "production") {
    diagnostic.localMessage = sanitizeDevelopmentText(error.message, secrets);
    diagnostic.localLocation = readSafeStackLocation(error.stack, secrets);
  }

  return diagnostic;
}

export function logAiProviderFailure(
  error: unknown,
  environment: ServerEnvironment = process.env,
): void {
  console.error(
    "[IntentSeal AI] Provider request failed",
    summarizeAiProviderFailure(error, environment),
  );
}

function classifyFailure(
  error: unknown,
  status: number | null | undefined,
  code: string | null,
  type: string | null,
): AiFailureCategory {
  const errorName = safeErrorName(error).toLowerCase();
  const providerCode = `${code ?? ""} ${type ?? ""}`.toLowerCase();
  if (error instanceof APIConnectionTimeoutError) return "timeout";
  if (errorName.includes("timeout") || status === 408 || status === 504) return "timeout";
  if (error instanceof APIUserAbortError) return "aborted";
  if (errorName.includes("abort")) return "aborted";
  if (
    error instanceof AuthenticationError ||
    status === 401 ||
    providerCode.includes("unauthenticated") ||
    providerCode.includes("api_key_invalid")
  ) {
    return "authentication";
  }
  if (
    error instanceof RateLimitError ||
    status === 429 ||
    providerCode.includes("resource_exhausted") ||
    providerCode.includes("quota")
  ) {
    return "rate_limit";
  }
  if (
    error instanceof NotFoundError ||
    status === 404 ||
    providerCode.includes("not_found") ||
    providerCode.includes("model_not_found")
  ) {
    return "model_not_found";
  }
  if (error instanceof PermissionDeniedError || status === 403) return "permission";
  if (
    error instanceof APIConnectionError ||
    errorName.includes("connection") ||
    errorName.includes("network") ||
    errorName.includes("fetch")
  ) {
    return "network";
  }
  if (status === 400 || status === 422) return "bad_request";
  if (typeof status === "number" && status >= 500) return "provider";
  return "unknown";
}

function safeErrorName(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownProviderError";
  const constructorName = error.constructor.name;
  const preferredName = constructorName === "Error" ? error.name : constructorName;
  return /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(preferredName) ? preferredName : "Error";
}

function safeConfigurationValue(
  value: string | null | undefined,
  secrets: Array<string | undefined>,
): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (containsSecret(normalized, secrets)) return "[invalid]";
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(normalized) ? normalized : "[invalid]";
}

function safeMetadata(
  value: string | null | undefined,
  secrets: Array<string | undefined>,
): string | null {
  if (!value || containsSecret(value, secrets)) return null;
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value) ? value : null;
}

function containsSecret(value: string, secrets: Array<string | undefined>): boolean {
  if (/^(?:sk-|AIza)/.test(value)) return true;
  return secrets.some((secret) => {
    const normalized = secret?.trim();
    return Boolean(normalized && normalized.length >= 8 && value.includes(normalized));
  });
}

function sanitizeDevelopmentText(
  value: string | undefined,
  secrets: Array<string | undefined>,
): string | null {
  if (!value) return null;

  let sanitized = value
    .replace(/Authorization\s*:\s*Bearer\s+\S+/gi, "Authorization: Bearer [REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]")
    .replace(/sk-(?:proj-)?[0-9A-Za-z_-]{12,}/g, "[REDACTED]");

  for (const secret of secrets) {
    const normalized = secret?.trim();
    if (normalized && normalized.length >= 8) {
      sanitized = sanitized.split(normalized).join("[REDACTED]");
    }
  }

  sanitized = sanitized.replace(/\s+/g, " ").trim();
  return sanitized ? sanitized.slice(0, 240) : null;
}

function readSafeStackLocation(
  stack: string | undefined,
  secrets: Array<string | undefined>,
): string | null {
  const location = stack
    ?.split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .find((line) => line.startsWith("at "));
  return sanitizeDevelopmentText(location, secrets);
}

function readGeminiMetadata(error: GeminiApiError | null): {
  code: string | null;
  type: string | null;
} {
  if (!error) return { code: null, type: null };

  try {
    const parsed = JSON.parse(error.message) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.error)) return { code: null, type: null };
    const providerError = parsed.error;
    const code = typeof providerError.status === "string" ? providerError.status : null;
    const details = Array.isArray(providerError.details) ? providerError.details : [];
    const reason = details.find(
      (detail): detail is Record<string, unknown> =>
        isRecord(detail) && typeof detail.reason === "string",
    )?.reason;
    return { code, type: typeof reason === "string" ? reason : null };
  } catch {
    return { code: null, type: null };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
