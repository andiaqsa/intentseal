import { ZodError } from "zod";

import type { StructuredIntent } from "../../shared/intent-structure";
import { logAiProviderFailure } from "../ai/diagnostics";
import { createIntentStructuringProvider, getAiTimeoutMs } from "../ai/factory";
import {
  AiConfigurationError,
  AiProviderResponseError,
  type IntentStructuringProvider,
} from "../ai/provider";
import { structuredIntentSchema, structureIntentRequestSchema } from "./schema";

interface RouteDependencies {
  provider?: IntentStructuringProvider;
  timeoutMs?: number;
}

class AiTimeoutError extends Error {
  constructor() {
    super("AI_REQUEST_TIMEOUT");
    this.name = "AiTimeoutError";
  }
}

export async function handleStructureIntent(
  request: Request,
  dependencies: RouteDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Use POST to structure an intent.", {
      Allow: "POST",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "Send a valid JSON request body.");
  }

  const requestResult = structureIntentRequestSchema.safeParse(body);
  if (!requestResult.success) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      requestResult.error.issues[0]?.message ?? "The intent description is invalid.",
    );
  }

  const controller = new AbortController();
  const timeoutMs = dependencies.timeoutMs ?? getAiTimeoutMs();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const provider = dependencies.provider ?? createIntentStructuringProvider();
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new AiTimeoutError());
      }, timeoutMs);
    });
    const providerResult = provider.structureIntent({
      text: requestResult.data.text,
      signal: controller.signal,
    });
    const structured = await Promise.race([providerResult, timeout]);
    const validated = structuredIntentSchema.parse(structured);
    return jsonResponse(200, pickStructuredIntent(validated));
  } catch (error) {
    if (error instanceof AiTimeoutError || controller.signal.aborted) {
      return errorResponse(504, "AI_TIMEOUT", "AI couldn't structure this intent in time.");
    }
    if (error instanceof AiConfigurationError) {
      const message =
        error.code === "AI_PROVIDER_UNSUPPORTED"
          ? "The configured AI provider is not supported."
          : "AI assistance is not configured. You can still write the intent manually.";
      return errorResponse(503, error.code, message);
    }
    if (error instanceof ZodError || error instanceof AiProviderResponseError) {
      return errorResponse(502, "AI_INVALID_RESPONSE", "AI returned an invalid intent draft.");
    }

    logAiProviderFailure(error);
    return errorResponse(502, "AI_UNAVAILABLE", "AI couldn't structure this intent.");
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function pickStructuredIntent(intent: StructuredIntent): StructuredIntent {
  return {
    title: intent.title,
    goal: intent.goal,
    criteria: [...intent.criteria],
  };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>,
): Response {
  return jsonResponse(status, { error: { code, message } }, headers);
}
