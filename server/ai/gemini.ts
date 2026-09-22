import {
  ApiError,
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";

import type { StructureIntentInput, StructuredIntent } from "../../shared/intent-structure";
import { structuredIntentJsonSchema, structuredIntentSchema } from "../intent/schema";
import { DEFAULT_GEMINI_MODEL } from "./config";
import { INTENT_STRUCTURING_INSTRUCTIONS, wrapUntrustedIntent } from "./prompt";
import { AiProviderResponseError, type IntentStructuringProvider } from "./provider";

export type GeminiGenerateContent = (
  parameters: GenerateContentParameters,
) => Promise<Pick<GenerateContentResponse, "text">>;

export class GeminiIntentStructuringProvider implements IntentStructuringProvider {
  private readonly generateContent: GeminiGenerateContent;

  constructor(
    apiKey: string,
    private readonly model = DEFAULT_GEMINI_MODEL,
    generateContent?: GeminiGenerateContent,
    private readonly unavailableRetryDelayMs = 250,
  ) {
    if (generateContent) {
      this.generateContent = generateContent;
      return;
    }

    const client = new GoogleGenAI({ apiKey });
    this.generateContent = client.models.generateContent.bind(client.models);
  }

  async structureIntent({ text, signal }: StructureIntentInput): Promise<StructuredIntent> {
    const parameters: GenerateContentParameters = {
      model: this.model,
      contents: wrapUntrustedIntent(text),
      config: {
        systemInstruction: INTENT_STRUCTURING_INSTRUCTIONS,
        responseMimeType: "application/json",
        responseJsonSchema: structuredIntentJsonSchema,
        abortSignal: signal,
        candidateCount: 1,
      },
    };
    const response = await this.generateWithUnavailableRetry(parameters, signal);

    if (!response.text) throw new AiProviderResponseError();

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      throw new AiProviderResponseError();
    }
    return structuredIntentSchema.parse(parsed);
  }

  private async generateWithUnavailableRetry(
    parameters: GenerateContentParameters,
    signal?: AbortSignal,
  ): Promise<Pick<GenerateContentResponse, "text">> {
    try {
      return await this.generateContent(parameters);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 503 || signal?.aborted) throw error;
      await waitForRetry(this.unavailableRetryDelayMs, signal);
      return this.generateContent(parameters);
    }
  }
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (delayMs <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);
    const handleAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}
