import {
  AlertCircle, ArrowRight, CheckCircle2, CircleDashed, ExternalLink, FileSearch,
  GitBranch, GitCommitHorizontal, LoaderCircle, LockKeyhole, MinusCircle, SearchX,
  ShieldCheck,
} from "lucide-react";
import { type ContractTransactionResponse } from "ethers";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import type { CriterionStatus, EvidenceAnalysisResult } from "../../../shared/evidence";
import { transactionExplorerUrl } from "../../config/network";
import { getIntentSealContract, parseOutcomeSealed, readIntent } from "../../lib/blockchain/contract";
import { getBrowserProvider } from "../../lib/blockchain/provider";
import { hashCanonicalPayload, parseCanonicalIntent } from "../../lib/canonical/intent";
import { canonicalizeOutcome, hashOutcome } from "../../lib/canonical/outcome";
import { analyzeEvidence } from "../../lib/evidence/analyze";
import { logDevelopmentError, toUserError } from "../../lib/errors";
import { getStoredIntent } from "../../lib/storage/intents";
import { storeOutcomeAnalysis } from "../../lib/storage/outcomes";
import type { CanonicalIntent, OnChainIntent, TransactionState } from "../../types/intent";
import { useWallet } from "../wallet/wallet-context";

interface LoadedIntent {
  intentId: string;
  canonical: CanonicalIntent;
  intentHash: string;
  onChain: OnChainIntent;
}

const analysisStages = [
  "Resolve repository", "Lock exact commit", "Scan bounded files", "Extract evidence", "Apply deterministic rules",
];

export function EvaluatePage() {
  const wallet = useWallet();
  const [intentId, setIntentId] = useState("");
  const [loaded, setLoaded] = useState<LoadedIntent | null>(null);
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [ref, setRef] = useState("");
  const [result, setResult] = useState<EvidenceAnalysisResult | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [transactionState, setTransactionState] = useState<TransactionState>("idle");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [sealedAt, setSealedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadIntent(event: FormEvent) {
    event.preventDefault();
    const normalizedId = intentId.trim();
    setResult(null);
    setLoaded(null);
    setError(null);
    setConfirmed(false);
    setTransactionState("idle");
    if (!/^[1-9]\d*$/.test(normalizedId)) {
      setError("Enter a valid intent ID greater than zero.");
      return;
    }
    setLoadingIntent(true);
    try {
      const [onChain, local] = await Promise.all([
        readIntent(BigInt(normalizedId)),
        Promise.resolve(getStoredIntent(BigInt(normalizedId).toString())),
      ]);
      if (!local) {
        setError("Full intent content is not available in this browser.");
        return;
      }
      const canonical = parseCanonicalIntent(local.canonicalPayload);
      const recalculated = hashCanonicalPayload(local.canonicalPayload);
      if (
        recalculated.toLowerCase() !== local.intentHash.toLowerCase() ||
        recalculated.toLowerCase() !== onChain.intentHash.toLowerCase()
      ) {
        setError("The local intent content does not match the on-chain intent hash.");
        return;
      }
      setLoaded({ intentId: normalizedId, canonical, intentHash: recalculated, onChain });
      if (onChain.completed) setError("This intent already has a sealed outcome.");
    } catch (loadError) {
      logDevelopmentError("Intent evaluation lookup failed", loadError);
      setError(toUserError(loadError, "read"));
    } finally {
      setLoadingIntent(false);
    }
  }

  async function runAnalysis(event: FormEvent) {
    event.preventDefault();
    if (!loaded || loaded.onChain.completed) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setConfirmed(false);
    setTransactionState("idle");
    try {
      const analysis = await analyzeEvidence({
        intentId: loaded.intentId,
        title: loaded.canonical.title,
        goal: loaded.canonical.goal,
        criteria: loaded.canonical.criteria,
        repositoryUrl: repositoryUrl.trim(),
        ...(ref.trim() ? { ref: ref.trim() } : {}),
      });
      storeOutcomeAnalysis({
        ...analysis,
        intentId: loaded.intentId,
        repository: analysis.outcomeDraft.source.repository,
        commit: analysis.outcomeDraft.source.commit,
      });
      setResult(analysis);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Evidence analysis failed. Try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function sealOutcome() {
    if (!loaded || !result || !confirmed || !wallet.account || !wallet.isCorrectNetwork) return;
    if (wallet.account.toLowerCase() !== loaded.onChain.creator.toLowerCase()) {
      setError("Only the wallet that created this intent can seal its outcome.");
      return;
    }
    const outcomeHash = hashOutcome(result.outcomeDraft);
    setError(null);
    setTransactionHash(null);
    setTransactionState("preparing");
    try {
      const provider = getBrowserProvider();
      const signer = await provider.getSigner();
      const contract = getIntentSealContract(signer);
      setTransactionState("awaiting_wallet");
      const transaction = await contract.completeIntent(
        BigInt(loaded.intentId), outcomeHash,
      ) as ContractTransactionResponse;
      setTransactionHash(transaction.hash);
      setTransactionState("submitted");
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      setTransactionState("confirming");
      const receipt = await transaction.wait();
      if (!receipt || receipt.status !== 1) throw new Error("TRANSACTION_REVERTED");
      const event = parseOutcomeSealed(receipt);
      if (event.intentId !== BigInt(loaded.intentId) || event.outcomeHash.toLowerCase() !== outcomeHash.toLowerCase()) {
        throw new Error("OUTCOME_EVENT_MISMATCH");
      }
      const readback = await readIntent(BigInt(loaded.intentId), provider);
      if (!readback.completed || readback.outcomeHash.toLowerCase() !== outcomeHash.toLowerCase()) {
        throw new Error("OUTCOME_READBACK_MISMATCH");
      }
      const verified = await contract.verifyOutcome(BigInt(loaded.intentId), outcomeHash) as boolean;
      if (!verified) throw new Error("OUTCOME_VERIFY_FAILED");

      storeOutcomeAnalysis({
        ...result,
        intentId: loaded.intentId,
        repository: result.outcomeDraft.source.repository,
        commit: result.outcomeDraft.source.commit,
        seal: {
          outcomeHash,
          transactionHash: transaction.hash,
          completedAt: Number(event.timestamp),
        },
      });
      setSealedAt(Number(event.timestamp));
      setTransactionState("success");
    } catch (sealError) {
      logDevelopmentError("Outcome sealing failed", sealError);
      const integrityFailure = sealError instanceof Error && [
        "OUTCOME_EVENT_MISMATCH", "OUTCOME_READBACK_MISMATCH", "OUTCOME_VERIFY_FAILED",
      ].includes(sealError.message);
      setError(integrityFailure
        ? "Integrity verification failed after confirmation. The outcome is not shown as verified."
        : toUserError(sealError, "transaction"));
      setTransactionState("error");
    }
  }

  return (
    <div className="mx-auto min-h-[calc(100vh-129px)] max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="mx-auto max-w-2xl text-center">
        <div className="mx-auto grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400"><FileSearch size={18} /></div>
        <p className="eyebrow mt-6">Deterministic Evidence Engine</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Prove the outcome</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-500">Lock one exact public GitHub commit, inspect rule-based evidence, then review every criterion before sealing.</p>
      </header>

      <form className="mx-auto mt-10 flex max-w-xl gap-2" onSubmit={(event) => void loadIntent(event)}>
        <label className="sr-only" htmlFor="evaluate-id">Intent ID</label>
        <input id="evaluate-id" className="input h-11" placeholder="Intent ID" inputMode="numeric" value={intentId} onChange={(event) => setIntentId(event.target.value)} />
        <button className="button button-primary h-11 px-5" disabled={loadingIntent}>
          {loadingIntent ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowRight size={15} />} Load intent
        </button>
      </form>

      {error && <div role="alert" className="mx-auto mt-5 flex max-w-2xl gap-2.5 rounded-lg border border-red-400/15 bg-red-400/[0.05] p-3 text-xs leading-5 text-red-200"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</div>}

      {loaded && (
        <div className="mx-auto mt-10 max-w-3xl space-y-5">
          <IntentSummary loaded={loaded} />
          {!loaded.onChain.completed && (
            <form className="panel p-5 sm:p-7" onSubmit={(event) => void runAnalysis(event)}>
              <div className="flex items-center gap-2 text-sm font-medium text-white"><GitBranch size={16} /> GitHub source</div>
              <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px]">
                <div><label className="label" htmlFor="repository-url">Repository URL</label><input id="repository-url" type="url" required className="input mt-2" placeholder="https://github.com/owner/repo" value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} /></div>
                <div><label className="label" htmlFor="repository-ref">Branch / ref</label><input id="repository-ref" className="input mt-2" placeholder="Default branch" value={ref} onChange={(event) => setRef(event.target.value)} /></div>
              </div>
              <p className="mt-4 text-xs leading-5 text-zinc-600">Public repositories only. A server-side GitHub token is optional and improves rate-limit reliability.</p>
              <button className="button button-primary mt-5 h-11" disabled={analyzing}>{analyzing ? <LoaderCircle size={15} className="animate-spin" /> : <FileSearch size={15} />}Analyze evidence</button>
            </form>
          )}
          {analyzing && <AnalysisStages />}
          {result && <EvaluationResult result={result} />}
          {result && transactionState !== "success" && (
            <OutcomeSealPanel
              result={result}
              confirmed={confirmed}
              onConfirmed={setConfirmed}
              onSeal={() => void sealOutcome()}
              state={transactionState}
              transactionHash={transactionHash}
              wallet={wallet}
              creator={loaded.onChain.creator}
            />
          )}
          {result && transactionState === "success" && transactionHash && sealedAt && (
            <section className="panel success-glow relative overflow-hidden p-6 sm:p-8" aria-label="Outcome sealed">
              <div className="relative flex items-start gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-emerald-400"><ShieldCheck size={20} /></span><div><p className="eyebrow text-emerald-400">Readback verified</p><h2 className="mt-2 text-xl font-medium text-white">Outcome sealed on BOT Chain</h2><p className="mt-2 text-sm leading-6 text-zinc-500">The stored outcome hash matches the exact canonical draft reviewed in this browser.</p></div></div>
              <div className="relative mt-6 flex flex-wrap gap-3"><Link className="button button-primary" to={`/verify?id=${loaded.intentId}`}>Open public proof</Link><a className="button button-secondary" href={transactionExplorerUrl(transactionHash)} target="_blank" rel="noreferrer">View transaction <ExternalLink size={12} /></a></div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function IntentSummary({ loaded }: { loaded: LoadedIntent }) {
  return <section className="panel p-5 sm:p-7"><div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Intent #{loaded.intentId} · Before</p><h2 className="mt-2 text-lg font-medium text-white">{loaded.canonical.title}</h2></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-semibold tracking-wider text-emerald-300">HASH VERIFIED</span></div><p className="mt-3 text-sm leading-6 text-zinc-500">{loaded.canonical.goal}</p><ol className="mt-5 space-y-2">{loaded.canonical.criteria.map((criterion, index) => <li key={criterion} className="flex gap-3 text-xs leading-5 text-zinc-400"><span className="font-mono text-zinc-700">{String(index + 1).padStart(2, "0")}</span>{criterion}</li>)}</ol></section>;
}

function AnalysisStages() {
  return <section aria-label="Analysis progress" className="panel p-5 sm:p-7"><div className="flex items-center gap-2 text-sm font-medium text-white"><LoaderCircle size={15} className="animate-spin text-emerald-400" />Collecting deterministic repository evidence</div><div className="mt-4 grid gap-2 sm:grid-cols-5">{analysisStages.map((stage) => <div key={stage} className="flex items-center gap-2 text-[11px] text-zinc-500"><CircleDashed size={12} />{stage}</div>)}</div></section>;
}

function EvaluationResult({ result }: { result: EvidenceAnalysisResult }) {
  const draft = result.outcomeDraft;
  return <section className="space-y-4" aria-label="Evaluation result">
    <div className="panel overflow-hidden"><div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div><p className="eyebrow">Draft - not yet sealed</p><h2 className="mt-2 text-lg font-medium text-white">Evidence locked to exact commit</h2></div><LockKeyhole size={20} className="text-emerald-400" /></div><dl className="grid gap-4 p-5 text-xs sm:grid-cols-2 sm:p-7"><div><dt className="text-zinc-600">Repository</dt><dd className="mt-1 text-zinc-300">{draft.source.repository}</dd></div><div><dt className="text-zinc-600">Full commit SHA</dt><dd className="mt-1 break-all font-mono text-zinc-300">{draft.source.commit}</dd></div><div><dt className="text-zinc-600">Evidence files</dt><dd className="mt-1 text-zinc-300">{result.evidenceFileCount}</dd></div><div><dt className="text-zinc-600">Method</dt><dd className="mt-1 text-zinc-300">Deterministic rule matching</dd></div></dl><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] p-5 sm:p-7"><a href={draft.source.commitUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white"><GitCommitHorizontal size={14} />View immutable commit <ExternalLink size={11} /></a><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-zinc-600">Outcome draft hash · Not yet sealed</p><p className="mt-1 max-w-[22rem] break-all font-mono text-[10px] text-zinc-400">{hashOutcome(draft)}</p></div></div></div>
    {draft.evaluations.map((evaluation) => <article key={evaluation.criterionIndex} className="panel p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">Criterion {String(evaluation.criterionIndex + 1).padStart(2, "0")}</p><h3 className="mt-2 text-sm font-medium text-white">{evaluation.criterion}</h3></div><StatusBadge status={evaluation.status} /></div><p className="mt-4 text-sm leading-6 text-zinc-500">{evaluation.explanation}</p>{evaluation.evidence.length > 0 ? <div className="mt-5 space-y-3">{evaluation.evidence.map((item) => <div key={`${item.path}:${item.startLine}:${item.endLine}`} className="rounded-lg border border-white/[0.07] bg-black/20 p-4"><p className="font-mono text-[11px] text-emerald-300">{item.path} · lines {item.startLine}-{item.endLine}</p><pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-5 text-zinc-500">{item.excerpt}</pre></div>)}</div> : <p className="mt-4 flex items-center gap-2 text-xs text-zinc-600"><SearchX size={13} />No sufficient repository evidence was found.</p>}</article>)}
    <p className="px-1 text-xs leading-5 text-zinc-600">SATISFIED means strong deterministic repository evidence was found. It does not prove absolute software correctness.</p>
  </section>;
}

interface SealPanelProps {
  result: EvidenceAnalysisResult;
  confirmed: boolean;
  onConfirmed: (value: boolean) => void;
  onSeal: () => void;
  state: TransactionState;
  transactionHash: string | null;
  wallet: ReturnType<typeof useWallet>;
  creator: string;
}

function OutcomeSealPanel({ result, confirmed, onConfirmed, onSeal, state, transactionHash, wallet, creator }: SealPanelProps) {
  const busy = !["idle", "error"].includes(state);
  const correctCreator = wallet.account?.toLowerCase() === creator.toLowerCase();
  const label = state === "awaiting_wallet" ? "Confirm in MetaMask" : state === "submitted" || state === "confirming" ? "Verifying on-chain readback" : state === "error" ? "Try sealing again" : "Seal reviewed outcome";
  return <section className="panel p-5 sm:p-7" aria-label="Seal outcome"><p className="eyebrow">Human review checkpoint</p><h2 className="mt-2 text-lg font-medium text-white">Seal only what you reviewed</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Repository evidence was collected from the locked commit. Review every criterion and the exact canonical outcome before recording its hash on BOT Chain.</p><details className="mt-5 rounded-lg border border-white/[0.07] bg-black/20 p-4"><summary className="cursor-pointer text-xs font-medium text-zinc-300">Review exact canonical outcome</summary><pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-5 text-zinc-500">{canonicalizeOutcome(result.outcomeDraft)}</pre></details><label className="mt-5 flex cursor-pointer items-start gap-3 text-xs leading-5 text-zinc-300"><input type="checkbox" className="mt-1 accent-emerald-400" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} />I reviewed every criterion, evidence excerpt, and the exact outcome hash above.</label>{!wallet.account && <p className="mt-4 text-xs text-amber-300">Connect the creator wallet to continue.</p>}{wallet.account && !wallet.isCorrectNetwork && <p className="mt-4 text-xs text-amber-300">Switch MetaMask to BOT Chain Testnet to continue.</p>}{wallet.account && wallet.isCorrectNetwork && !correctCreator && <p className="mt-4 text-xs text-red-300">Connected wallet is not the intent creator.</p>}<button className="button button-primary mt-5 h-11" disabled={!confirmed || !wallet.account || !wallet.isCorrectNetwork || !correctCreator || busy} onClick={onSeal}>{busy && <LoaderCircle size={15} className="animate-spin" />}{label}</button>{transactionHash && <a className="mt-3 block break-all font-mono text-[10px] text-zinc-500 hover:text-white" href={transactionExplorerUrl(transactionHash)} target="_blank" rel="noreferrer">{transactionHash}</a>}</section>;
}

function StatusBadge({ status }: { status: CriterionStatus }) {
  const styles = { SATISFIED: "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300", PARTIAL: "border-amber-400/20 bg-amber-400/[0.07] text-amber-300", NOT_FOUND: "border-zinc-400/20 bg-zinc-400/[0.06] text-zinc-400" };
  const Icon = status === "SATISFIED" ? CheckCircle2 : status === "PARTIAL" ? MinusCircle : SearchX;
  return <span className={`inline-flex self-start items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wider ${styles[status]}`}><Icon size={11} />{status}</span>;
}
