import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_AI_SERVER_TIMEOUT_MS } from "../../../shared/intent-structure";
import { AI_REQUEST_TIMEOUT_MS } from "../../config/ai";
import { structureIntent } from "./structureIntent";

const structuredIntent = {
  title: "Add a health check",
  goal: "Implement a health check endpoint for service monitoring.",
  criteria: ["The endpoint returns a successful response when the service is healthy."],
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AI request safety timeout", () => {
  it("is strictly longer than the maximum configurable server timeout", () => {
    expect(AI_REQUEST_TIMEOUT_MS).toBeGreaterThan(MAX_AI_SERVER_TIMEOUT_MS);
  });

  it("does not abort a response completing after 20 seconds but before the safety deadline", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal as AbortSignal;
        return new Promise<Response>((resolve) => {
          window.setTimeout(() => resolve(Response.json(structuredIntent)), 21_000);
        });
      }),
    );

    const request = structureIntent("Add a health check and tests.");
    await vi.advanceTimersByTimeAsync(20_000);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(request).resolves.toEqual(structuredIntent);
    expect(requestSignal?.aborted).toBe(false);
  });

  it("aborts an infrastructure request that exceeds the frontend safety deadline", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal as AbortSignal;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      }),
    );

    const request = structureIntent("Add a health check and tests.");
    const rejection = expect(request).rejects.toMatchObject({
      userMessage: "AI took too long to respond. Write manually or try again.",
    });
    await vi.advanceTimersByTimeAsync(AI_REQUEST_TIMEOUT_MS);

    await rejection;
    expect(requestSignal?.aborted).toBe(true);
    expect(warning).toHaveBeenCalledWith("[IntentSeal AI] Request safety timeout");
  });
});
