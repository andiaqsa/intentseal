import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  FilePenLine,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { type ContractTransactionResponse } from "ethers";

import {
  BOT_CHAIN,
  contractExplorerUrl,
  transactionExplorerUrl,
} from "../../config/network";
import { useWallet } from "../wallet/wallet-context";
import { canonicalizeIntent, hashCanonicalPayload } from "../../lib/canonical/intent";
import {
  getIntentSealContract,
  parseIntentSealed,
  readIntent,
  type IntentSealedEvent,
} from "../../lib/blockchain/contract";
import { getBrowserProvider } from "../../lib/blockchain/provider";
import { logDevelopmentError, toUserError } from "../../lib/errors";
import { shortenAddress } from "../../lib/format";
import { storeSealedIntent } from "../../lib/storage/intents";
import {
  IntentStructuringError,
  structureIntent as requestStructuredIntent,
} from "../../lib/ai/structureIntent";
import { MAX_ROUGH_INTENT_LENGTH } from "../../../shared/intent-structure";
import type { IntentInput, TransactionState } from "../../types/intent";

const initialIntent: IntentInput = { title: "", goal: "", criteria: [""] };

interface SuccessData extends IntentSealedEvent {
  transactionHash: string;
}

type CreateStage = "describe" | "form" | "review" | "success";
type AiStructuringState = "idle" | "typing" | "structuring" | "success" | "error";

const transactionLabels: Record<TransactionState, string> = {
  idle: "Ready",
  preparing: "Preparing proof",
  awaiting_wallet: "Waiting for wallet approval",
  submitted: "Transaction submitted",
  confirming: "Waiting for confirmation",
  success: "Intent sealed",
  error: "Transaction failed",
};

export function CreateIntentPage() {
  const wallet = useWallet();
  const [stage, setStage] = useState<CreateStage>("describe");
  const [intent, setIntent] = useState<IntentInput>(initialIntent);
  const [roughIntent, setRoughIntent] = useState("");
  const [aiState, setAiState] = useState<AiStructuringState>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [draftSource, setDraftSource] = useState<"ai" | "manual">("manual");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [transactionState, setTransactionState] = useState<TransactionState>("idle");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const proof = useMemo(() => {
    if (stage !== "review" && stage !== "success") return null;
    try {
      const canonicalPayload = canonicalizeIntent(intent);
      return { canonicalPayload, intentHash: hashCanonicalPayload(canonicalPayload) };
    } catch {
      return null;
    }
  }, [intent, stage]);

  function updateRoughIntent(value: string) {
    setRoughIntent(value);
    setAiError(null);
    setAiState(value.trim() ? "typing" : "idle");
  }

  async function structureWithAi() {
    if (aiState === "structuring") return;
    setAiState("structuring");
    setAiError(null);
    try {
      const structured = await requestStructuredIntent(roughIntent);
      setIntent({
        title: structured.title,
        goal: structured.goal,
        criteria: [...structured.criteria],
      });
      setDraftSource("ai");
      setAiState("success");
      setStage("form");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      logDevelopmentError("Intent structuring failed", error);
      setAiState("error");
      setAiError(
        error instanceof IntentStructuringError
          ? error.userMessage
          : "AI couldn't structure this intent.",
      );
    }
  }

  function writeManually() {
    setDraftSource("manual");
    setStage("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateCriterion(index: number, value: string) {
    setIntent((current) => ({
      ...current,
      criteria: current.criteria.map((criterion, itemIndex) =>
        itemIndex === index ? value : criterion,
      ),
    }));
  }

  function removeCriterion(index: number) {
    if (intent.criteria.length === 1) return;
    setIntent((current) => ({
      ...current,
      criteria: current.criteria.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function openReview() {
    try {
      canonicalizeIntent(intent);
      setFormError(null);
      setConfirmed(false);
      setStage("review");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Complete every field to continue.");
    }
  }

  async function sealIntent() {
    if (!proof || !confirmed || !wallet.account || !wallet.isCorrectNetwork) return;

    setTransactionError(null);
    setTransactionHash(null);
    setTransactionState("preparing");

    try {
      const provider = getBrowserProvider();
      const signer = await provider.getSigner();
      const contract = getIntentSealContract(signer);

      setTransactionState("awaiting_wallet");
      const transaction = (await contract.createIntent(
        proof.intentHash,
      )) as ContractTransactionResponse;
      setTransactionHash(transaction.hash);
      setTransactionState("submitted");

      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      setTransactionState("confirming");
      const receipt = await transaction.wait();
      if (!receipt || receipt.status !== 1) throw new Error("TRANSACTION_REVERTED");

      const sealedEvent = parseIntentSealed(receipt);
      if (sealedEvent.intentHash.toLowerCase() !== proof.intentHash.toLowerCase()) {
        throw new Error("EVENT_HASH_MISMATCH");
      }

      const storedIntent = await readIntent(sealedEvent.intentId, provider);
      if (storedIntent.intentHash.toLowerCase() !== proof.intentHash.toLowerCase()) {
        throw new Error("ON_CHAIN_HASH_MISMATCH");
      }

      storeSealedIntent({
        intentId: sealedEvent.intentId.toString(),
        creator: sealedEvent.creator,
        canonicalPayload: proof.canonicalPayload,
        intentHash: proof.intentHash,
        transactionHash: transaction.hash,
        createdAt: Number(sealedEvent.timestamp),
      });

      setSuccessData({ ...sealedEvent, transactionHash: transaction.hash });
      setTransactionState("success");
      setStage("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      logDevelopmentError("Intent creation failed", error);
      const integrityFailure =
        error instanceof Error &&
        ["EVENT_HASH_MISMATCH", "ON_CHAIN_HASH_MISMATCH"].includes(error.message);
      setTransactionError(
        integrityFailure
          ? "Integrity check failed: the confirmed on-chain hash does not match your reviewed intent. No local record was saved."
          : toUserError(error, "transaction"),
      );
      setTransactionState("error");
    }
  }

  function reset() {
    setIntent(initialIntent);
    setRoughIntent("");
    setAiState("idle");
    setAiError(null);
    setDraftSource("manual");
    setConfirmed(false);
    setTransactionState("idle");
    setTransactionHash(null);
    setTransactionError(null);
    setSuccessData(null);
    setStage("describe");
  }

  return (
    <div className="mx-auto min-h-[calc(100vh-129px)] max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mb-10 flex flex-col gap-5 border-b border-white/[0.07] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Create proof</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
            {stage === "success" ? "Intent sealed" : "Create an intent"}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">
            {stage === "success"
              ? "Your proof is confirmed and independently readable on BOT Chain."
              : "Define the outcome before the work begins. AI can help structure the draft; you approve every word."}
          </p>
        </div>
        <StageIndicator stage={stage} />
      </div>

      {stage === "describe" && (
        <DescribeIntent
          value={roughIntent}
          state={aiState}
          error={aiError}
          onChange={updateRoughIntent}
          onStructure={() => void structureWithAi()}
          onManual={writeManually}
        />
      )}

      {stage === "form" && (
        <IntentForm
          intent={intent}
          error={formError}
          draftSource={draftSource}
          onChange={setIntent}
          onCriterionChange={updateCriterion}
          onCriterionRemove={removeCriterion}
          onReview={openReview}
          onRegenerate={() => {
            setAiError(null);
            setAiState(roughIntent.trim() ? "typing" : "idle");
            setStage("describe");
          }}
        />
      )}

      {stage === "review" && proof && (
        <ReviewIntent
          intent={intent}
          canonicalPayload={proof.canonicalPayload}
          intentHash={proof.intentHash}
          confirmed={confirmed}
          transactionState={transactionState}
          transactionHash={transactionHash}
          transactionError={transactionError}
          onConfirmedChange={setConfirmed}
          onBack={() => {
            setTransactionError(null);
            setTransactionState("idle");
            setStage("form");
          }}
          onSeal={() => void sealIntent()}
        />
      )}

      {stage === "success" && successData && proof && (
        <SuccessView data={successData} onReset={reset} />
      )}
    </div>
  );
}

interface DescribeIntentProps {
  value: string;
  state: AiStructuringState;
  error: string | null;
  onChange: (value: string) => void;
  onStructure: () => void;
  onManual: () => void;
}

function DescribeIntent({
  value,
  state,
  error,
  onChange,
  onStructure,
  onManual,
}: DescribeIntentProps) {
  const structuring = state === "structuring";
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="panel p-5 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-2.5 py-1 text-[10px] font-medium text-emerald-300">
              <Sparkles size={11} /> AI-assisted
            </div>
            <h2 className="mt-5 text-xl font-medium tracking-[-0.02em] text-white">
              Describe your intent
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              IntentSeal can turn a rough description into a clearer draft. You remain in control
              of the final wording.
            </p>
          </div>
        </div>

        <label className="sr-only" htmlFor="rough-intent">
          What are you planning to do?
        </label>
        <textarea
          id="rough-intent"
          className="input mt-7 min-h-44 resize-y text-sm leading-6"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Add rate limiting to the login endpoint so brute-force attempts are blocked, return a useful error when the limit is exceeded, and add tests."
          maxLength={MAX_ROUGH_INTENT_LENGTH}
          disabled={structuring}
          autoFocus
        />
        <div className="mt-2 flex justify-between text-[10px] text-zinc-700">
          <span>Rough notes stay editable if the request fails.</span>
          <span className="font-mono">{value.length}/{MAX_ROUGH_INTENT_LENGTH}</span>
        </div>

        {error && <InlineError message={error} />}

        <div className="mt-7 flex flex-col gap-3 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="button button-secondary h-10"
            onClick={onManual}
            disabled={structuring}
          >
            <FilePenLine size={14} /> Write manually
          </button>
          <button
            type="button"
            className="button button-primary h-10 px-4"
            onClick={onStructure}
            disabled={structuring || !value.trim()}
          >
            {structuring ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : state === "error" ? (
              <RefreshCw size={14} />
            ) : (
              <Sparkles size={14} />
            )}
            {structuring ? "Structuring intent…" : state === "error" ? "Try again" : "Structure with AI"}
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="panel p-5">
          <p className="eyebrow">You stay in control</p>
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            AI suggestions are editable. Only the exact version you approve is hashed and sealed.
          </p>
        </div>
        <div className="panel p-5">
          <LockKeyhole size={17} className="text-emerald-400" />
          <h3 className="mt-4 text-sm font-medium text-zinc-200">No automatic signing</h3>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            AI cannot open MetaMask or write to BOT Chain. Sealing still requires the existing
            review and explicit confirmation.
          </p>
        </div>
      </aside>
    </div>
  );
}

function StageIndicator({ stage }: { stage: CreateStage }) {
  const current = stage === "describe" || stage === "form" ? 1 : stage === "review" ? 2 : 3;
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${current} of 3`}>
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center gap-2">
          <span className={`grid size-6 place-items-center rounded-full border text-[10px] font-medium ${step < current ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : step === current ? "border-zinc-400 bg-zinc-100 text-zinc-950" : "border-white/10 text-zinc-700"}`}>
            {step < current ? <Check size={11} /> : step}
          </span>
          {step < 3 && <span className={`h-px w-5 ${step < current ? "bg-emerald-400/30" : "bg-white/10"}`} />}
        </div>
      ))}
    </div>
  );
}

interface FormProps {
  intent: IntentInput;
  error: string | null;
  draftSource: "ai" | "manual";
  onChange: (intent: IntentInput) => void;
  onCriterionChange: (index: number, value: string) => void;
  onCriterionRemove: (index: number) => void;
  onReview: () => void;
  onRegenerate: () => void;
}

function IntentForm({
  intent,
  error,
  draftSource,
  onChange,
  onCriterionChange,
  onCriterionRemove,
  onReview,
  onRegenerate,
}: FormProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form
        className="panel p-5 sm:p-8"
        onSubmit={(event) => {
          event.preventDefault();
          onReview();
        }}
      >
        <div className="mb-7 flex flex-col gap-3 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-white">
                {draftSource === "ai" ? "Review structured intent" : "Write intent manually"}
              </h2>
              {draftSource === "ai" && (
                <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-emerald-300">
                  AI-assisted
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              {draftSource === "ai"
                ? "Edit anything below. Your edits—not the original suggestion—become the proof."
                : "Define the exact wording you want to review and seal."}
            </p>
          </div>
          {draftSource === "ai" && (
            <button
              type="button"
              className="inline-flex items-center gap-2 self-start rounded-lg px-2.5 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200"
              onClick={onRegenerate}
            >
              <RefreshCw size={13} /> Regenerate
            </button>
          )}
        </div>
        <div className="field-group">
          <label className="label" htmlFor="intent-title">Title</label>
          <p className="field-help">A short, descriptive name for this intent.</p>
          <input
            id="intent-title"
            className="input"
            value={intent.title}
            onChange={(event) => onChange({ ...intent, title: event.target.value })}
            placeholder="Add API rate limiting"
            maxLength={120}
            autoFocus
          />
        </div>

        <div className="field-group">
          <label className="label" htmlFor="intent-goal">Goal</label>
          <p className="field-help">Describe what you intend to accomplish before considering the work complete.</p>
          <textarea
            id="intent-goal"
            className="input min-h-28 resize-y"
            value={intent.goal}
            onChange={(event) => onChange({ ...intent, goal: event.target.value })}
            placeholder="Implement login endpoint rate limiting before completing the task."
            maxLength={1000}
          />
        </div>

        <fieldset className="field-group">
          <legend className="label">Success criteria</legend>
          <p className="field-help">Add measurable conditions. Their order is preserved in the proof.</p>
          <div className="space-y-3">
            {intent.criteria.map((criterion, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="mt-3.5 w-5 shrink-0 text-center font-mono text-[10px] text-zinc-700">{String(index + 1).padStart(2, "0")}</span>
                <textarea
                  className="input min-h-[46px] resize-y py-3"
                  aria-label={`Criterion ${index + 1}`}
                  value={criterion}
                  onChange={(event) => onCriterionChange(index, event.target.value)}
                  placeholder={index === 0 ? "Maximum 5 login attempts per minute per IP" : "Another measurable criterion"}
                  maxLength={500}
                />
                <button
                  type="button"
                  className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-zinc-700 transition hover:bg-red-400/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                  onClick={() => onCriterionRemove(index)}
                  disabled={intent.criteria.length === 1}
                  aria-label={`Remove criterion ${index + 1}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200"
            onClick={() => onChange({ ...intent, criteria: [...intent.criteria, ""] })}
          >
            <Plus size={14} /> Add criterion
          </button>
        </fieldset>

        {error && <InlineError message={error} />}
        <div className="mt-8 flex justify-end border-t border-white/[0.07] pt-6">
          <button className="button button-primary h-10 px-4" type="submit">
            Review intent <ArrowRight size={14} />
          </button>
        </div>
      </form>

      <aside className="space-y-4">
        <div className="panel p-5">
          <LockKeyhole size={18} className="text-emerald-400" />
          <h2 className="mt-5 text-sm font-medium text-zinc-200">Private by default</h2>
          <p className="mt-2 text-xs leading-5 text-zinc-500">Your title, goal, and criteria stay in this browser. Only a 32-byte hash is sent to the contract.</p>
        </div>
        <div className="panel p-5">
          <p className="eyebrow">Normalization</p>
          <ul className="mt-4 space-y-3 text-xs text-zinc-500">
            {["Outer whitespace trimmed", "Line endings normalized to LF", "Criteria order preserved", "UTF-8 encoded before hashing"].map((item) => (
              <li className="flex gap-2" key={item}><Check size={13} className="mt-0.5 text-zinc-600" />{item}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

interface ReviewProps {
  intent: IntentInput;
  canonicalPayload: string;
  intentHash: string;
  confirmed: boolean;
  transactionState: TransactionState;
  transactionHash: string | null;
  transactionError: string | null;
  onConfirmedChange: (value: boolean) => void;
  onBack: () => void;
  onSeal: () => void;
}

function ReviewIntent(props: ReviewProps) {
  const wallet = useWallet();
  const isBusy = !["idle", "error"].includes(props.transactionState);
  const canSeal = props.confirmed && wallet.account && wallet.isCorrectNetwork && !isBusy;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <div className="panel overflow-hidden">
          <div className="border-b border-white/[0.07] p-5 sm:p-7">
            <p className="eyebrow">Intent content</p>
            <h2 className="mt-4 text-xl font-medium tracking-[-0.02em] text-white">{intentClean(props.intent.title)}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{intentClean(props.intent.goal)}</p>
          </div>
          <div className="p-5 sm:p-7">
            <p className="label">Measurable criteria</p>
            <div className="mt-4 space-y-3">
              {props.intent.criteria.map((criterion, index) => (
                <div key={index} className="flex gap-3 rounded-lg border border-white/[0.06] bg-black/15 p-3.5 text-sm leading-6 text-zinc-300">
                  <span className="font-mono text-[10px] text-emerald-400/70">{String(index + 1).padStart(2, "0")}</span>
                  {intentClean(criterion)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div><p className="eyebrow">Canonical payload</p><p className="mt-2 text-xs text-zinc-600">Exact UTF-8 content used to calculate the hash</p></div>
            <span className="rounded-md border border-white/[0.07] px-2 py-1 font-mono text-[10px] text-zinc-600">v1</span>
          </div>
          <pre className="mt-5 overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-white/[0.07] bg-black/30 p-4 font-mono text-[11px] leading-5 text-zinc-400">{props.canonicalPayload}</pre>
          <div className="mt-5">
            <p className="label">Keccak-256 hash</p>
            <p className="mt-2 break-all rounded-lg bg-emerald-400/[0.05] px-3 py-2.5 font-mono text-[11px] leading-5 text-emerald-300">{props.intentHash}</p>
          </div>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="panel p-5">
          <div className="flex items-center gap-2.5"><Fingerprint size={17} className="text-emerald-400" /><h2 className="text-sm font-medium text-white">Seal this proof</h2></div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">Only this cryptographic hash will be stored on-chain. Your full intent remains off-chain.</p>

          <div className="mt-5 rounded-lg border border-white/[0.07] bg-black/20 p-3 text-xs">
            <div className="flex justify-between gap-4"><span className="text-zinc-600">Network</span><span className={wallet.isCorrectNetwork ? "text-zinc-300" : "text-amber-300"}>{wallet.isCorrectNetwork ? BOT_CHAIN.chainName : "Action required"}</span></div>
            <div className="mt-2 flex justify-between gap-4"><span className="text-zinc-600">Wallet</span><span className="font-mono text-zinc-300">{wallet.account ? shortenAddress(wallet.account) : "Not connected"}</span></div>
          </div>

          {!wallet.account && (
            <button className="button button-secondary mt-3 w-full" onClick={() => void wallet.connect()}>Connect MetaMask</button>
          )}
          {wallet.account && !wallet.isCorrectNetwork && (
            <button className="button button-secondary mt-3 w-full" onClick={() => void wallet.switchNetwork()}>Switch to BOT Chain</button>
          )}
          {wallet.error && <p className="mt-3 text-xs leading-5 text-red-300">{wallet.error}</p>}

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.07] p-3 transition hover:border-white/[0.14]">
            <input type="checkbox" className="mt-0.5 size-3.5 accent-emerald-500" checked={props.confirmed} onChange={(event) => props.onConfirmedChange(event.target.checked)} disabled={isBusy} />
            <span className="text-xs leading-5 text-zinc-400">I reviewed the exact content and hash above.</span>
          </label>

          {props.transactionState !== "idle" && <TransactionStatus state={props.transactionState} transactionHash={props.transactionHash} />}
          {props.transactionError && <div className="mt-3"><InlineError message={props.transactionError} /></div>}

          <button className="button button-primary mt-4 h-11 w-full" disabled={!canSeal} onClick={props.onSeal}>
            {isBusy ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            {isBusy ? transactionLabels[props.transactionState] : props.transactionState === "error" ? "Try again" : "Seal intent on-chain"}
          </button>
          <button className="button mt-2 h-9 w-full text-xs text-zinc-600 hover:text-zinc-300" disabled={isBusy} onClick={props.onBack}><ArrowLeft size={13} /> Back to edit</button>
        </div>
      </aside>
    </div>
  );
}

function TransactionStatus({ state, transactionHash }: { state: TransactionState; transactionHash: string | null }) {
  const complete = state === "success";
  const failed = state === "error";
  return (
    <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/20 p-3">
      <div className="flex items-center gap-2.5 text-xs">
        {complete ? <CheckCircle2 size={14} className="text-emerald-400" /> : failed ? <AlertCircle size={14} className="text-red-300" /> : <LoaderCircle size={14} className="animate-spin text-emerald-400" />}
        <span className={failed ? "text-red-200" : "text-zinc-300"}>{transactionLabels[state]}</span>
      </div>
      {transactionHash && (
        <a className="mt-2 block truncate font-mono text-[10px] text-zinc-600 transition hover:text-zinc-300" href={transactionExplorerUrl(transactionHash)} target="_blank" rel="noreferrer">{transactionHash}</a>
      )}
    </div>
  );
}

function SuccessView({ data, onReset }: { data: SuccessData; onReset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="panel overflow-hidden">
        <div className="relative border-b border-white/[0.07] px-5 py-10 text-center sm:px-10 sm:py-12">
          <div className="success-glow absolute inset-x-0 top-0 mx-auto h-48 max-w-lg" />
          <div className="relative mx-auto grid size-12 place-items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-400"><Check size={22} strokeWidth={2} /></div>
          <p className="eyebrow mt-5">Created before outcome</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Intent sealed</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">The event was verified, and the stored hash matches the exact payload you reviewed.</p>
        </div>
        <dl className="divide-y divide-white/[0.06] px-5 sm:px-8">
          <ResultRow label="Intent ID" value={`#${data.intentId.toString()}`} strong />
          <ResultRow label="Creator" value={data.creator} mono />
          <ResultRow label="Intent hash" value={data.intentHash} mono />
          <ResultRow label="Transaction" value={data.transactionHash} mono />
        </dl>
        <div className="grid gap-3 border-t border-white/[0.07] p-5 sm:grid-cols-2 sm:p-8">
          <a className="button button-primary" href={transactionExplorerUrl(data.transactionHash)} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13} /></a>
          <a className="button button-secondary" href={contractExplorerUrl()} target="_blank" rel="noreferrer">View contract <ExternalLink size={13} /></a>
        </div>
      </div>
      <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-white/[0.07] p-4 text-xs text-zinc-600 sm:flex-row">
        <span>Full intent saved as local application data in this browser.</span>
        <button className="inline-flex items-center gap-2 text-zinc-400 transition hover:text-white" onClick={onReset}><RotateCcw size={12} /> Create another</button>
      </div>
    </div>
  );
}

function ResultRow({ label, value, mono = false, strong = false }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[120px_1fr] sm:items-center">
      <dt className="text-xs text-zinc-600">{label}</dt>
      <dd className={`break-all text-xs ${mono ? "font-mono text-zinc-400" : ""} ${strong ? "text-base font-medium text-white" : ""}`}>{value}</dd>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return <div className="mt-5 flex gap-2.5 rounded-lg border border-red-400/15 bg-red-400/[0.05] p-3 text-xs leading-5 text-red-200"><AlertCircle size={14} className="mt-0.5 shrink-0" />{message}</div>;
}

function intentClean(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}
