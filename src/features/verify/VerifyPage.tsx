import { AlertCircle, ArrowRight, Check, Clock3, ExternalLink, FileKey2, GitCommitHorizontal, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import { ZeroHash } from "ethers";
import { type FormEvent, useEffect, useState } from "react";

import { BOT_CHAIN, contractExplorerUrl } from "../../config/network";
import { readIntent } from "../../lib/blockchain/contract";
import { hashCanonicalPayload, parseCanonicalIntent } from "../../lib/canonical/intent";
import { hashOutcome } from "../../lib/canonical/outcome";
import { logDevelopmentError, toUserError } from "../../lib/errors";
import { formatTimestamp } from "../../lib/format";
import { getStoredIntent } from "../../lib/storage/intents";
import { getStoredOutcomeForIntent, type StoredOutcomeAnalysis } from "../../lib/storage/outcomes";
import type { CanonicalIntent, OnChainIntent, SealedIntentRecord } from "../../types/intent";

interface ProofState {
  onChain: OnChainIntent;
  intent: SealedIntentRecord | null;
  canonical: CanonicalIntent | null;
  outcome: StoredOutcomeAnalysis | null;
  intentMatches: boolean;
  outcomeMatches: boolean;
}

export function VerifyPage() {
  const queryIntentId = new URLSearchParams(window.location.search).get("id") ?? "";
  const [intentId, setIntentId] = useState(queryIntentId);
  const [proof, setProof] = useState<ProofState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProof(normalizedId: string) {
    setLoading(true);
    setError(null);
    setProof(null);
    try {
      const onChain = await readIntent(BigInt(normalizedId));
      const intent = getStoredIntent(normalizedId);
      const outcome = getStoredOutcomeForIntent(normalizedId);
      let canonical: CanonicalIntent | null = null;
      let intentMatches = false;
      if (intent) {
        intentMatches = hashCanonicalPayload(intent.canonicalPayload).toLowerCase() === onChain.intentHash.toLowerCase();
        try {
          canonical = parseCanonicalIntent(intent.canonicalPayload);
        } catch {
          canonical = null;
        }
      }
      const outcomeMatches = Boolean(
        outcome && onChain.completed && hashOutcome(outcome.outcomeDraft).toLowerCase() === onChain.outcomeHash.toLowerCase(),
      );
      setProof({ onChain, intent, canonical, outcome, intentMatches, outcomeMatches });
    } catch (verifyError) {
      logDevelopmentError("Proof lookup failed", verifyError);
      setError(toUserError(verifyError, "read"));
    } finally {
      setLoading(false);
    }
  }

  function verify(event: FormEvent) {
    event.preventDefault();
    const normalizedId = intentId.trim();
    if (!/^[1-9]\d*$/.test(normalizedId)) {
      setError("Enter a valid intent ID greater than zero.");
      setProof(null);
      return;
    }
    void loadProof(BigInt(normalizedId).toString());
  }

  useEffect(() => {
    if (!/^[1-9]\d*$/.test(queryIntentId)) return;
    const handle = window.setTimeout(() => void loadProof(BigInt(queryIntentId).toString()), 0);
    return () => window.clearTimeout(handle);
    // URL input is captured only when this page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedId = /^[1-9]\d*$/.test(intentId.trim()) ? BigInt(intentId.trim()).toString() : intentId;
  return <div className="mx-auto min-h-[calc(100vh-129px)] max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
    <header className="mx-auto max-w-2xl text-center"><div className="mx-auto grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400"><Search size={18} /></div><p className="eyebrow mt-6">IntentSeal Proof</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Verify the full chronology</h1><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-500">Read hashes and timestamps directly from {BOT_CHAIN.chainName}. No wallet connection required.</p></header>
    <form className="mx-auto mt-10 flex max-w-xl gap-2" noValidate onSubmit={verify}><label className="sr-only" htmlFor="verify-id">Intent ID</label><div className="relative flex-1"><span className="absolute inset-y-0 left-4 flex items-center font-mono text-xs text-zinc-700">#</span><input id="verify-id" inputMode="numeric" pattern="[0-9]*" className="input h-11 pl-8" placeholder="Enter intent ID" value={intentId} onChange={(event) => setIntentId(event.target.value)} /></div><button className="button button-primary h-11 px-5" disabled={loading}>{loading ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowRight size={15} />}<span className="hidden sm:inline">Verify</span></button></form>
    {error && <div role="alert" className="mx-auto mt-5 flex max-w-xl gap-2.5 rounded-lg border border-red-400/15 bg-red-400/[0.05] p-3 text-xs leading-5 text-red-200"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</div>}
    {proof && <ProofView intentId={normalizedId} proof={proof} />}
  </div>;
}

function ProofView({ intentId, proof }: { intentId: string; proof: ProofState }) {
  const { onChain, canonical, outcome } = proof;
  const fullyVerified = proof.intentMatches && (!onChain.completed || proof.outcomeMatches);
  return <div className="mx-auto mt-10 max-w-4xl space-y-5">
    <section className="panel overflow-hidden"><div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div className="flex items-center gap-3"><div className={`grid size-10 place-items-center rounded-full ${fullyVerified ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-300"}`}>{fullyVerified ? <ShieldCheck size={19} /> : <FileKey2 size={18} />}</div><div><p className="eyebrow">Intent #{intentId}</p><h2 className="mt-1 text-xl font-medium text-white">{fullyVerified ? "Proof verified" : "On-chain record verified"}</h2></div></div><span className={`self-start rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wider ${onChain.completed ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300" : "border-amber-400/20 bg-amber-400/[0.07] text-amber-300"}`}>{onChain.completed ? "COMPLETED" : "OPEN"}</span></div>
      <div className="grid border-b border-white/[0.07] md:grid-cols-3"><TimelineCard label="Before · T1" title="Intent sealed" value={formatTimestamp(onChain.createdAt)} /><TimelineCard label="Evidence" title={outcome ? "Exact commit locked" : "Local evidence unavailable"} value={outcome?.commit.slice(0, 12) ?? "—"} middle /><TimelineCard label="After · T2" title={onChain.completed ? "Outcome sealed" : "Not yet sealed"} value={onChain.completedAt ? formatTimestamp(onChain.completedAt) : "—"} /></div>
      <dl className="divide-y divide-white/[0.06] px-5 sm:px-7"><VerifyRow label="Creator" value={onChain.creator} mono /><VerifyRow label="Intent hash" value={onChain.intentHash} mono /><VerifyRow label="Outcome hash" value={onChain.outcomeHash === ZeroHash ? "Not recorded" : onChain.outcomeHash} mono={onChain.outcomeHash !== ZeroHash} muted={onChain.outcomeHash === ZeroHash} /><VerifyRow label="Completed" value={onChain.completedAt === 0n ? "Not completed" : formatTimestamp(onChain.completedAt)} muted={onChain.completedAt === 0n} /></dl>
    </section>

    {proof.intent && <section className="panel p-5 sm:p-7"><div className="flex items-center gap-2 text-xs font-medium text-zinc-300"><FileKey2 size={14} className="text-emerald-400" />Local intent available</div><p className="mt-2 text-xs leading-5 text-zinc-600">The full canonical payload is stored as local application data in this browser.</p><pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-3 font-mono text-[10px] leading-5 text-zinc-500">{proof.intent.canonicalPayload}</pre></section>}

    {canonical && <section className="panel p-5 sm:p-7"><p className="eyebrow">What was promised</p><h2 className="mt-3 text-xl font-medium text-white">{canonical.title}</h2><p className="mt-3 text-sm leading-6 text-zinc-500">{canonical.goal}</p><ol className="mt-5 space-y-3">{canonical.criteria.map((criterion, index) => <li className="flex gap-3 text-sm text-zinc-400" key={criterion}><span className="font-mono text-xs text-zinc-700">{String(index + 1).padStart(2, "0")}</span>{criterion}</li>)}</ol></section>}

    {outcome && <section className="space-y-4"><div className="panel p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Evidence · exact commit</p><p className="mt-3 text-sm text-white">{outcome.repository}</p><p className="mt-2 break-all font-mono text-[11px] text-zinc-500">{outcome.commit}</p></div><a className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white" href={outcome.outcomeDraft.source.commitUrl} target="_blank" rel="noreferrer"><GitCommitHorizontal size={14} />View commit <ExternalLink size={11} /></a></div></div>{outcome.outcomeDraft.evaluations.map((evaluation) => <article className="panel p-5 sm:p-7" key={evaluation.criterionIndex}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Criterion {String(evaluation.criterionIndex + 1).padStart(2, "0")}</p><h3 className="mt-2 text-sm font-medium text-white">{evaluation.criterion}</h3></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-zinc-300">{evaluation.status}</span></div><p className="mt-4 text-sm leading-6 text-zinc-500">{evaluation.explanation}</p>{evaluation.evidence.map((item) => <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/20 p-4" key={`${item.path}:${item.startLine}`}><p className="font-mono text-[11px] text-emerald-300">{item.path} · lines {item.startLine}-{item.endLine}</p><pre className="mt-3 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-5 text-zinc-500">{item.excerpt}</pre></div>)}</article>)}</section>}

    <section className="panel p-5 sm:p-7"><p className="eyebrow">Integrity</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><IntegrityCheck label="Intent hash matches BOT Chain" checked={proof.intentMatches} /><IntegrityCheck label="Outcome hash matches BOT Chain" checked={proof.outcomeMatches} pending={!onChain.completed} /><IntegrityCheck label="Exact Git commit locked" checked={Boolean(outcome?.commit)} /><IntegrityCheck label="Intent existed before outcome" checked={onChain.completed && onChain.completedAt >= onChain.createdAt} pending={!onChain.completed} /><IntegrityCheck label="Creator identity recorded" checked={onChain.creator !== ZeroHash.slice(0, 42)} /></div><p className="mt-6 border-t border-white/[0.07] pt-5 text-xs leading-5 text-zinc-600">BOT Chain proves when hashes were recorded. GitHub provides immutable commit evidence. IntentSeal proves chronology, integrity, and provenance—not absolute software correctness.</p><a className="mt-4 inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-white" href={contractExplorerUrl()} target="_blank" rel="noreferrer">View source contract <ExternalLink size={11} /></a></section>
  </div>;
}

function TimelineCard({ label, title, value, middle = false }: { label: string; title: string; value: string; middle?: boolean }) {
  return <div className={`p-5 sm:p-6 ${middle ? "border-y border-white/[0.07] md:border-x md:border-y-0" : ""}`}><p className="eyebrow">{label}</p><p className="mt-3 text-sm font-medium text-white">{title}</p><p className="mt-2 font-mono text-[10px] text-zinc-600">{value}</p></div>;
}

function IntegrityCheck({ label, checked, pending = false }: { label: string; checked: boolean; pending?: boolean }) {
  return <div className={`flex items-center gap-2 text-xs ${checked ? "text-emerald-300" : "text-zinc-600"}`}>{checked ? <Check size={13} /> : pending ? <Clock3 size={13} /> : <AlertCircle size={13} />}{pending ? `${label} (pending)` : label}</div>;
}

function VerifyRow({ label, value, mono = false, muted = false }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return <div className="grid gap-2 py-4 sm:grid-cols-[120px_1fr] sm:items-center"><dt className="text-xs text-zinc-600">{label}</dt><dd className={`min-w-0 break-all text-xs ${mono ? "font-mono" : ""} ${muted ? "text-zinc-700" : "text-zinc-400"}`}>{value}</dd></div>;
}
