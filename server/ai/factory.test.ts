import { describe, expect, it } from "vitest";

import { DEFAULT_GEMINI_MODEL, getConfiguredAiModel } from "./config";
import { createIntentStructuringProvider, getAiTimeoutMs } from "./factory";
import { GeminiIntentStructuringProvider } from "./gemini";
import { OpenAiIntentStructuringProvider } from "./openai";

describe("AI provider factory", () => {
  it("requires the selected provider's server-side credential", () => {
    expect(() => createIntentStructuringProvider({})).toThrow("AI_NOT_CONFIGURED");
    expect(() =>
      createIntentStructuringProvider({ AI_PROVIDER: "openai", AI_MODEL: "gpt-4o-mini" }),
    ).toThrow("AI_NOT_CONFIGURED");
    expect(() => createIntentStructuringProvider({ AI_PROVIDER: "gemini" })).toThrow(
      "AI_NOT_CONFIGURED",
    );
  });

  it("selects Gemini without requiring an OpenAI key", () => {
    expect(
      createIntentStructuringProvider({
        AI_PROVIDER: "gemini",
        GEMINI_API_KEY: "gemini-placeholder",
      }),
    ).toBeInstanceOf(GeminiIntentStructuringProvider);
    expect(getConfiguredAiModel({ AI_PROVIDER: "gemini" })).toBe(DEFAULT_GEMINI_MODEL);
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3-flash-preview");
  });

  it("selects OpenAI without requiring a Gemini key", () => {
    expect(
      createIntentStructuringProvider({
        AI_PROVIDER: "openai",
        AI_API_KEY: "openai-placeholder",
        AI_MODEL: "gpt-4o-mini",
      }),
    ).toBeInstanceOf(OpenAiIntentStructuringProvider);
  });

  it("rejects unsupported providers", () => {
    expect(() =>
      createIntentStructuringProvider({
        AI_PROVIDER: "unknown-vendor",
        AI_API_KEY: "placeholder",
        AI_MODEL: "placeholder",
      }),
    ).toThrow("AI_PROVIDER_UNSUPPORTED");
  });

  it("accepts only bounded timeout configuration", () => {
    expect(getAiTimeoutMs({ AI_TIMEOUT_MS: "8000" })).toBe(8_000);
    expect(getAiTimeoutMs({ AI_TIMEOUT_MS: "100" })).toBe(15_000);
    expect(getAiTimeoutMs({ AI_TIMEOUT_MS: "not-a-number" })).toBe(15_000);
  });
});
