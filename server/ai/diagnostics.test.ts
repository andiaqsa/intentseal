import { ApiError as GeminiApiError } from "@google/genai";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
} from "openai";
import { describe, expect, it, vi } from "vitest";

import { logAiProviderFailure, summarizeAiProviderFailure } from "./diagnostics";

const environment = {
  AI_PROVIDER: "openai",
  AI_API_KEY: "test-only-secret-that-must-not-be-logged",
  AI_MODEL: "gpt-4o-mini",
};

describe("safe AI provider diagnostics", () => {
  it.each([
    {
      expected: "authentication",
      error: new AuthenticationError(
        401,
        { code: "invalid_api_key", type: "invalid_request_error", message: "sensitive body" },
        "sensitive fallback",
        new Headers({ "x-request-id": "req_auth" }),
      ),
    },
    {
      expected: "rate_limit",
      error: new RateLimitError(
        429,
        { code: "insufficient_quota", type: "insufficient_quota" },
        undefined,
        new Headers({ "x-request-id": "req_rate" }),
      ),
    },
    {
      expected: "model_not_found",
      error: new NotFoundError(
        404,
        { code: "model_not_found", type: "invalid_request_error" },
        undefined,
        new Headers({ "x-request-id": "req_model" }),
      ),
    },
    { expected: "network", error: new APIConnectionError({ message: "sensitive network" }) },
    { expected: "timeout", error: new APIConnectionTimeoutError() },
  ])("classifies $expected without exposing error messages", ({ error, expected }) => {
    const diagnostic = summarizeAiProviderFailure(error, environment);
    const serialized = JSON.stringify(diagnostic);

    expect(diagnostic.category).toBe(expected);
    expect(diagnostic.apiKeyConfigured).toBe(true);
    expect(diagnostic.provider).toBe("openai");
    expect(diagnostic.model).toBe("gpt-4o-mini");
    expect(serialized).not.toContain("sensitive");
    expect(serialized).not.toContain(environment.AI_API_KEY);
  });

  it("logs only the safe summary, never the credential or provider message", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new AuthenticationError(
      401,
      {
        code: "invalid_api_key",
        type: "invalid_request_error",
        message: `Rejected credential ${environment.AI_API_KEY}`,
      },
      undefined,
      new Headers({ "x-request-id": "req_safe" }),
    );

    logAiProviderFailure(error, environment);

    const serializedLog = JSON.stringify(consoleSpy.mock.calls);
    expect(serializedLog).toContain("authentication");
    expect(serializedLog).toContain("invalid_api_key");
    expect(serializedLog).not.toContain(environment.AI_API_KEY);
    expect(serializedLog).not.toContain("Rejected credential");
  });

  it.each([
    {
      expected: "authentication",
      status: 401,
      providerStatus: "UNAUTHENTICATED",
      reason: "API_KEY_INVALID",
    },
    {
      expected: "rate_limit",
      status: 429,
      providerStatus: "RESOURCE_EXHAUSTED",
      reason: "RATE_LIMIT_EXCEEDED",
    },
    {
      expected: "model_not_found",
      status: 404,
      providerStatus: "NOT_FOUND",
      reason: "MODEL_NOT_FOUND",
    },
  ])("safely classifies Gemini $expected errors", ({ expected, status, providerStatus, reason }) => {
    const geminiEnvironment = {
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-only-gemini-secret",
      AI_MODEL: "gemini-2.5-flash",
    };
    const error = new GeminiApiError({
      status,
      message: JSON.stringify({
        error: {
          status: providerStatus,
          message: `sensitive ${geminiEnvironment.GEMINI_API_KEY}`,
          details: [{ reason }],
        },
      }),
    });

    const diagnostic = summarizeAiProviderFailure(error, geminiEnvironment);
    const serialized = JSON.stringify(diagnostic);

    expect(diagnostic.category).toBe(expected);
    expect(diagnostic.apiKeyConfigured).toBe(true);
    expect(diagnostic.code).toBe(providerStatus);
    expect(diagnostic.type).toBe(reason);
    expect(serialized).not.toContain(geminiEnvironment.GEMINI_API_KEY);
    expect(serialized).not.toContain("sensitive");
  });

  it("classifies a Gemini SDK-style timeout without logging a configured key", () => {
    const timeout = new Error("message must not be logged");
    timeout.name = "RequestTimeoutError";
    const geminiEnvironment = {
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-only-gemini-secret",
      AI_MODEL: "gemini-2.5-flash",
    };

    const diagnostic = summarizeAiProviderFailure(timeout, geminiEnvironment);

    expect(diagnostic.category).toBe("timeout");
    expect(JSON.stringify(diagnostic)).not.toContain(geminiEnvironment.GEMINI_API_KEY);
  });

  it("includes a redacted local TypeError message and stack location only in development", () => {
    const secret = "test-only-local-secret";
    const localEnvironment = {
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: secret,
      AI_MODEL: "gemini-2.5-flash",
      NODE_ENV: "development",
    };
    const error = new TypeError(
      `Cannot read local value Authorization: Bearer ${secret} AIza123456789012345678901234567890`,
    );
    error.stack = `TypeError: hidden\n    at ${secret} (E:/workspace/server/ai/gemini.ts:42:10)`;

    const diagnostic = summarizeAiProviderFailure(error, localEnvironment);
    const serialized = JSON.stringify(diagnostic);

    expect(diagnostic.localMessage).toContain("Cannot read local value");
    expect(diagnostic.localMessage).toContain("[REDACTED]");
    expect(diagnostic.localLocation).toContain("gemini.ts:42:10");
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("AIza123456789012345678901234567890");

    const productionDiagnostic = summarizeAiProviderFailure(error, {
      ...localEnvironment,
      NODE_ENV: "production",
    });
    expect(productionDiagnostic).not.toHaveProperty("localMessage");
    expect(productionDiagnostic).not.toHaveProperty("localLocation");
  });
});
