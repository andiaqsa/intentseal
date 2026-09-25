import type { EvidenceSnippet } from "../../shared/evidence";
import type { GitHubTextFile } from "./github";

const stopWords = new Set([
  "about", "after", "again", "against", "being", "between", "could", "explicit", "from",
  "have", "into", "must", "only", "should", "their", "there", "these", "this", "those",
  "through", "uses", "using", "when", "where", "which", "with", "would", "behavior",
  "requests", "criterion", "criteria", "implement", "implemented",
]);
const baselinePatterns = [
  /^readme(?:\.[^/]+)?$/i,
  /(?:^|\/)package\.json$/i,
  /(?:^|\/)pyproject\.toml$/i,
  /(?:^|\/)cargo\.toml$/i,
  /(?:^|\/)go\.mod$/i,
  /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)/i,
  /\.(?:test|spec)\.[^.]+$/i,
  /(?:^|\/)(?:src|app|lib)(?:\/|$)/i,
];

export function extractCriterionKeywords(criteria: string[]): string[] {
  const tokens = criteria
    .join(" ")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? [];
  const expanded = new Set(tokens.filter((token) => !stopWords.has(token)));
  if ([...expanded].some((token) => token === "rate" || token.includes("rate-limit") || token === "limiting")) {
    ["ratelimit", "rate-limit", "throttle", "middleware"].forEach((value) => expanded.add(value));
  }
  if (expanded.has("429")) {
    ["too many requests", "too_many_requests", "status(429"].forEach((value) => expanded.add(value));
  }
  if (expanded.has("test") || expanded.has("tests") || expanded.has("automated")) {
    ["test", "spec", "__tests__"].forEach((value) => expanded.add(value));
  }
  return [...expanded].sort();
}

export function selectCandidatePaths(paths: string[], criteria: string[]): string[] {
  const keywords = extractCriterionKeywords(criteria);
  return [...paths]
    .map((path) => {
      const lower = path.toLowerCase();
      const keywordScore = keywords.reduce(
        (score, keyword) => score + (lower.includes(keyword.replace(/\s+/g, "")) || lower.includes(keyword) ? 8 : 0),
        0,
      );
      const baselineScore = baselinePatterns.reduce(
        (score, pattern, index) => score + (pattern.test(path) ? 7 - Math.min(index, 5) : 0),
        0,
      );
      return { path, score: keywordScore + baselineScore };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .map((entry) => entry.path);
}

export function extractEvidenceSnippets(
  files: GitHubTextFile[],
  criteria: string[],
): EvidenceSnippet[] {
  const keywords = extractCriterionKeywords(criteria);
  const snippets: EvidenceSnippet[] = [];

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const lines = file.content.replace(/\r\n?/g, "\n").split("\n");
    const matchingLines = lines
      .map((line, index) => ({ line: line.toLowerCase(), index }))
      .filter(({ line }) => keywords.some((keyword) => line.includes(keyword)))
      .map(({ index }) => index);
    const anchors = matchingLines.length > 0 ? matchingLines.slice(0, 2) : [0];

    for (const anchor of anchors) {
      const start = Math.max(0, anchor - 3);
      const end = Math.min(lines.length - 1, anchor + 3);
      const excerpt = lines.slice(start, end + 1).join("\n").trim();
      if (!excerpt) continue;
      const matched = keywords.filter((keyword) => excerpt.toLowerCase().includes(keyword)).slice(0, 4);
      snippets.push({
        path: file.path,
        startLine: start + 1,
        endLine: end + 1,
        excerpt: excerpt.slice(0, 1_500),
        reason: matched.length > 0 ? `Matched criterion terms: ${matched.join(", ")}` : "Repository context file",
      });
    }
  }

  return snippets.slice(0, 40);
}
