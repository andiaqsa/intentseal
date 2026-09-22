import {
  GoogleGenAI,
  type GenerateContentConfig,
  type GenerateContentParameters,
} from "@google/genai";

import { loadLocalServerEnvironment } from "../environment";
import { getConfiguredAiModel, getConfiguredAiProvider } from "./config";
import { summarizeAiProviderFailure } from "./diagnostics";

loadLocalServerEnvironment();

const provider = getConfiguredAiProvider();
const model = getConfiguredAiModel();
const apiKey = process.env.GEMINI_API_KEY?.trim();

if (provider !== "gemini" || !model || !apiKey) {
  console.error("[IntentSeal AI] Gemini probe configuration unavailable", {
    provider,
    model,
    apiKeyConfigured: Boolean(apiKey),
  });
  process.exitCode = 1;
} else {
  const client = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const probeSchema = {
    type: "object",
    additionalProperties: false,
    properties: { result: { type: "string" } },
    required: ["result"],
  } as const;
  const stages: Array<{
    name: string;
    contents: string;
    config?: GenerateContentConfig;
  }> = [
    { name: "A_minimal", contents: "Return the word OK" },
    {
      name: "B_system_instruction",
      contents: "Return the word OK",
      config: { systemInstruction: "Respond concisely." },
    },
    {
      name: "C_json_mime_type",
      contents: "Return the JSON string OK",
      config: {
        systemInstruction: "Respond concisely.",
        responseMimeType: "application/json",
      },
    },
    {
      name: "D_json_schema",
      contents: "Return a JSON object with result set to OK",
      config: {
        systemInstruction: "Respond concisely.",
        responseMimeType: "application/json",
        responseJsonSchema: probeSchema,
      },
    },
    {
      name: "E_abort_signal",
      contents: "Return a JSON object with result set to OK",
      config: {
        systemInstruction: "Respond concisely.",
        responseMimeType: "application/json",
        responseJsonSchema: probeSchema,
        abortSignal: controller.signal,
      },
    },
  ];

  const requestedStartStage = process.argv[2];
  const startIndex = requestedStartStage
    ? stages.findIndex((stage) => stage.name === requestedStartStage)
    : 0;

  if (startIndex < 0) {
    console.error("[IntentSeal AI] Unknown Gemini probe stage", {
      requestedStartStage,
      availableStages: stages.map((stage) => stage.name),
    });
    process.exitCode = 1;
  }

  for (const stage of startIndex < 0 ? [] : stages.slice(startIndex)) {
    const startedAt = performance.now();
    const parameters: GenerateContentParameters = {
      model,
      contents: stage.contents,
      ...(stage.config ? { config: stage.config } : {}),
    };

    try {
      await client.models.generateContent(parameters);
      console.log("[IntentSeal AI] Gemini probe", {
        stage: stage.name,
        provider,
        model,
        success: true,
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      const diagnostic = summarizeAiProviderFailure(error);
      console.error("[IntentSeal AI] Gemini probe", {
        stage: stage.name,
        provider,
        model,
        success: false,
        durationMs: Math.round(performance.now() - startedAt),
        error: diagnostic,
      });
      process.exitCode = 1;
      break;
    }
  }
}
