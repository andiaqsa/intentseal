import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadLocalServerEnvironment } from "./environment";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("local server environment loading", () => {
  it("preserves process values, then prefers .env.local over .env", () => {
    const directory = mkdtempSync(join(tmpdir(), "intentseal-env-"));
    temporaryDirectories.push(directory);
    writeFileSync(
      join(directory, ".env.local"),
      "AI_PROVIDER=local-provider\nAI_API_KEY=local-placeholder\nGEMINI_API_KEY=local-gemini-placeholder\nAI_MODEL=local-model\n",
    );
    writeFileSync(
      join(directory, ".env"),
      "AI_PROVIDER=base-provider\nAI_API_KEY=base-placeholder\nGEMINI_API_KEY=base-gemini-placeholder\nAI_MODEL=base-model\nAI_TIMEOUT_MS=9000\n",
    );
    const environment: NodeJS.ProcessEnv = {
      AI_PROVIDER: "process-provider",
      GEMINI_API_KEY: "process-gemini-placeholder",
    };

    loadLocalServerEnvironment({ cwd: directory, environment });

    expect(environment).toEqual({
      AI_PROVIDER: "process-provider",
      AI_API_KEY: "local-placeholder",
      GEMINI_API_KEY: "process-gemini-placeholder",
      AI_MODEL: "local-model",
      AI_TIMEOUT_MS: "9000",
    });
  });
});
