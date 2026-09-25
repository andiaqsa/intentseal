import { describe, expect, it } from "vitest";

import { canonicalizeIntent, hashIntent, parseCanonicalIntent } from "./intent";

const baseIntent = {
  title: "Add API rate limiting",
  goal: "Implement login endpoint rate limiting before completing the task.",
  criteria: [
    "Maximum 5 login attempts per minute per IP",
    "Return HTTP 429 when limit is exceeded",
    "Add automated tests for rate limiting",
  ],
};

describe("canonical intent", () => {
  it("uses an explicit schema and fixed key order", () => {
    expect(canonicalizeIntent(baseIntent)).toBe(
      '{"schema":"intentseal.intent.v1","title":"Add API rate limiting","goal":"Implement login endpoint rate limiting before completing the task.","criteria":["Maximum 5 login attempts per minute per IP","Return HTTP 429 when limit is exceeded","Add automated tests for rate limiting"]}',
    );
  });

  it("normalizes outer whitespace and line endings deterministically", () => {
    const noisy = {
      title: "  Add API rate limiting  ",
      goal: "\r\nImplement login endpoint rate limiting before completing the task.\r\n",
      criteria: baseIntent.criteria.map((criterion) => `\t${criterion}\r\n`),
    };

    expect(canonicalizeIntent(noisy)).toBe(canonicalizeIntent(baseIntent));
    expect(hashIntent(noisy)).toBe(hashIntent(baseIntent));
  });

  it("changes the hash when the goal changes", () => {
    expect(hashIntent({ ...baseIntent, goal: `${baseIntent.goal} Safely.` })).not.toBe(
      hashIntent(baseIntent),
    );
  });

  it("changes the hash when a criterion changes", () => {
    const criteria = [...baseIntent.criteria];
    criteria[0] = "Maximum 10 login attempts per minute per IP";
    expect(hashIntent({ ...baseIntent, criteria })).not.toBe(hashIntent(baseIntent));
  });

  it("preserves criterion order, making reordering hash-significant", () => {
    expect(hashIntent({ ...baseIntent, criteria: [...baseIntent.criteria].reverse() })).not.toBe(
      hashIntent(baseIntent),
    );
  });

  it("rejects blank criteria after normalization", () => {
    expect(() => hashIntent({ ...baseIntent, criteria: ["  \r\n "] })).toThrow(
      "Every criterion must contain text.",
    );
  });

  it("parses only an exact canonical payload", () => {
    const payload = canonicalizeIntent(baseIntent);
    expect(parseCanonicalIntent(payload)).toEqual({ schema: "intentseal.intent.v1", ...baseIntent });
    expect(() => parseCanonicalIntent(JSON.stringify({ ...JSON.parse(payload), extra: true }))).toThrow(
      "not canonical",
    );
  });
});
