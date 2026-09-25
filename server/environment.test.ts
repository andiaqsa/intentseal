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
      "GITHUB_TOKEN=local-placeholder\nEVIDENCE_TIMEOUT_MS=25000\nLOCAL_ONLY=yes\n",
    );
    writeFileSync(
      join(directory, ".env"),
      "GITHUB_TOKEN=base-placeholder\nEVIDENCE_TIMEOUT_MS=9000\nBASE_ONLY=yes\n",
    );
    const environment: NodeJS.ProcessEnv = {
      GITHUB_TOKEN: "process-placeholder",
    };

    loadLocalServerEnvironment({ cwd: directory, environment });

    expect(environment).toEqual({
      GITHUB_TOKEN: "process-placeholder",
      EVIDENCE_TIMEOUT_MS: "25000",
      LOCAL_ONLY: "yes",
      BASE_ONLY: "yes",
    });
  });
});
