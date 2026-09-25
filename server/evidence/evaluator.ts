import {
  OUTCOME_SCHEMA,
  type CriterionEvaluation,
  type EvidenceProviderInput,
  type EvidenceReference,
  type EvidenceSnippet,
  type OutcomeDraft,
} from "../../shared/evidence";

const COMMON_WORDS = new Set([
  "add", "after", "all", "and", "are", "automated", "before", "behavior",
  "complete", "completing", "configured", "cover", "each", "endpoint", "exact",
  "explicit", "for", "from", "has", "have", "implement", "implemented", "into",
  "limit", "limited", "maximum", "per", "request", "requests", "return", "the",
  "their", "this", "when", "with",
]);

interface Signal {
  label: string;
  matches: (haystack: string, path: string) => boolean;
}

interface RankedEvidence {
  snippet: EvidenceSnippet;
  score: number;
  matchedTerms: string[];
  matchedSignals: string[];
}

export function evaluateEvidenceDeterministically(
  input: EvidenceProviderInput,
  source: OutcomeDraft["source"],
): OutcomeDraft {
  return {
    schema: OUTCOME_SCHEMA,
    intentId: input.intentId,
    source,
    evaluations: input.criteria.map((criterion, criterionIndex) =>
      evaluateCriterion(criterion, criterionIndex, input.evidence),
    ),
  };
}

function evaluateCriterion(
  criterion: string,
  criterionIndex: number,
  evidence: EvidenceSnippet[],
): CriterionEvaluation {
  const terms = meaningfulTerms(criterion);
  const signals = technicalSignals(criterion);
  const ranked = evidence
    .map((snippet) => rankSnippet(snippet, terms, signals))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.snippet.path.localeCompare(b.snippet.path) ||
        a.snippet.startLine - b.snippet.startLine ||
        a.snippet.endLine - b.snippet.endLine ||
        a.snippet.excerpt.localeCompare(b.snippet.excerpt),
    );

  const selected = selectDistinctEvidence(ranked, 3);
  const combined = selected.map((item) => normalizedHaystack(item.snippet)).join("\n");
  const combinedPaths = selected.map((item) => item.snippet.path.toLowerCase()).join("\n");
  const coveredSignals = signals.filter((signal) => signal.matches(combined, combinedPaths));
  const coveredTerms = terms.filter((term) => combined.includes(term));
  const signalCoverage = signals.length === 0 ? 1 : coveredSignals.length / signals.length;
  const termCoverage = terms.length === 0 ? 0 : coveredTerms.length / terms.length;
  const hasStrongCoverage = selected.length > 0 && signalCoverage === 1 && termCoverage >= 0.45;
  const hasPartialCoverage = selected.length > 0 && (coveredSignals.length > 0 || termCoverage >= 0.2);
  const status = hasStrongCoverage ? "SATISFIED" : hasPartialCoverage ? "PARTIAL" : "NOT_FOUND";
  const references = status === "NOT_FOUND" ? [] : selected.map(toReference);

  return {
    criterionIndex,
    criterion,
    status,
    explanation: explanationFor(status, references, coveredSignals.map((item) => item.label), signals),
    evidence: references,
  };
}

function meaningfulTerms(value: string): string[] {
  const normalized = normalize(value);
  return [...new Set(normalized.split(" ").filter((term) =>
    term.length >= 3 && !COMMON_WORDS.has(term) && !/^\d+$/.test(term),
  ))].sort();
}

function technicalSignals(criterion: string): Signal[] {
  const value = normalize(criterion);
  const signals: Signal[] = [];
  const add = (label: string, matches: Signal["matches"]) => {
    if (!signals.some((signal) => signal.label === label)) signals.push({ label, matches });
  };

  for (const number of value.match(/\b\d+\b/g) ?? []) {
    add(`numeric value ${number}`, (text) => new RegExp(`\\b${number}\\b`).test(text));
  }
  if (/\b429\b|too many requests/.test(value)) {
    add("HTTP 429 handling", (text) => /\b429\b|too many requests|status\s*\(\s*429/.test(text));
  }
  if (/\btest(?:s|ing)?\b|automated/.test(value)) {
    add("automated test code", (text, path) =>
      /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|\.(?:test|spec)\.[^/]+/.test(path) &&
      /\b(?:describe|it|test|expect)\s*\(/.test(text),
    );
  }
  if (/rate[ -]?limit|limiting|throttl/.test(value)) {
    add("rate-limit implementation", (text) => /rate[ -]?limit|ratelimit|limiter|throttl/.test(text));
  }
  if (/\bip\b|per ip/.test(value)) {
    add("per-IP handling", (text) => /\bip\b|req\s*\.\s*ip|remoteaddress|keygenerator/.test(text));
  }
  if (/\bminute\b|time window|window/.test(value)) {
    add("time-window configuration", (text) => /windowms|window|60\s*_?\s*000|60000|minute/.test(text));
  }
  if (/threshold|maximum|\bmax\b|attempt/.test(value)) {
    add("request threshold", (text) => /max(?:imum)?|threshold|attempt|limit/.test(text));
  }
  return signals;
}

function rankSnippet(snippet: EvidenceSnippet, terms: string[], signals: Signal[]): RankedEvidence {
  const text = normalizedHaystack(snippet);
  const path = snippet.path.toLowerCase();
  const matchedTerms = terms.filter((term) => text.includes(term));
  const matchedSignals = signals.filter((signal) => signal.matches(text, path)).map((signal) => signal.label);
  const pathBonus = /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|\.(?:test|spec)\./.test(path) ? 2 : 0;
  return {
    snippet,
    matchedTerms,
    matchedSignals,
    score: matchedSignals.length * 12 + matchedTerms.length * 3 + (matchedSignals.length > 0 ? pathBonus : 0),
  };
}

function selectDistinctEvidence(items: RankedEvidence[], limit: number): RankedEvidence[] {
  const selected: RankedEvidence[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.snippet.path}:${item.snippet.startLine}:${item.snippet.endLine}`;
    if (seen.has(key)) continue;
    selected.push(item);
    seen.add(key);
    if (selected.length === limit) break;
  }
  return selected;
}

function normalizedHaystack(snippet: EvidenceSnippet): string {
  return normalize(`${snippet.path}\n${snippet.excerpt}`);
}

function normalize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9./()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toReference(item: RankedEvidence): EvidenceReference {
  return {
    path: item.snippet.path,
    startLine: item.snippet.startLine,
    endLine: item.snippet.endLine,
    excerpt: item.snippet.excerpt,
  };
}

function explanationFor(
  status: CriterionEvaluation["status"],
  evidence: EvidenceReference[],
  coveredSignals: string[],
  expectedSignals: Signal[],
): string {
  if (status === "NOT_FOUND") {
    return "No sufficient repository evidence matching this criterion was found.";
  }
  const first = evidence[0]!;
  const location = `${first.path}, lines ${first.startLine}-${first.endLine}`;
  if (status === "SATISFIED") {
    const detail = coveredSignals.length > 0 ? ` The selected code contains ${joinLabels(coveredSignals)}.` : "";
    return `Strong matching evidence was found in ${location}.${detail}`;
  }
  const missing = expectedSignals.filter((signal) => !coveredSignals.includes(signal.label)).map((signal) => signal.label);
  const detail = missing.length > 0
    ? `, but it does not clearly establish ${joinLabels(missing)}`
    : ", but the deterministic rules do not find enough criterion-specific coverage";
  return `Some relevant repository evidence was found in ${location}${detail}.`;
}

function joinLabels(values: string[]): string {
  if (values.length < 2) return values[0] ?? "criterion-specific technical signals";
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}
