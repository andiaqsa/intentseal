import type { EvidenceSnippet, OutcomeDraft } from "../../../shared/evidence";

export const goldenIntent = {
  intentId: "5",
  title: "Add login rate limiting",
  goal: "Implement login rate limiting.",
  criteria: [
    "Login uses an explicit rate-limit threshold and time window.",
    "Rate-limited requests return HTTP 429.",
    "Automated tests cover rate-limited behavior.",
  ],
};

export const goldenFiles = [
  {
    path: "src/middleware/rateLimit.ts",
    content: "const WINDOW_MS = 60_000;\nconst MAX_ATTEMPTS = 5;\nexport const loginLimiter = rateLimit({ windowMs: WINDOW_MS, max: MAX_ATTEMPTS });",
  },
  {
    path: "src/routes/login.ts",
    content: "export function login(req, res) {\n  if (req.rateLimit.exceeded) {\n    return res.status(429).json({ error: 'Too Many Requests' });\n  }\n}",
  },
  {
    path: "tests/rateLimit.test.ts",
    content: "test('rate-limited requests return 429', async () => {\n  const response = await exceedLoginLimit();\n  expect(response.status).toBe(429);\n});",
  },
];

export function goldenOutcome(evidence: EvidenceSnippet[]): OutcomeDraft {
  const byPath = (path: string) => {
    const value = evidence.find((item) => item.path === path);
    if (!value) throw new Error(`Missing fixture evidence: ${path}`);
    return {
      path: value.path,
      startLine: value.startLine,
      endLine: value.endLine,
      excerpt: value.excerpt,
    };
  };
  return {
    schema: "intentseal.outcome.v1",
    intentId: goldenIntent.intentId,
    source: {
      type: "github",
      repository: "demo/rate-limit-app",
      commit: "a".repeat(40),
      commitUrl: `https://github.com/demo/rate-limit-app/commit/${"a".repeat(40)}`,
    },
    evaluations: goldenIntent.criteria.map((criterion, criterionIndex) => ({
      criterionIndex,
      criterion,
      status: "SATISFIED" as const,
      explanation: "Direct repository evidence supports this criterion.",
      evidence: [
        byPath(
          [
            "src/middleware/rateLimit.ts",
            "src/routes/login.ts",
            "tests/rateLimit.test.ts",
          ][criterionIndex]!,
        ),
      ],
    })),
  };
}
