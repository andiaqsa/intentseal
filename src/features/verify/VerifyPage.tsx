import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileKey2,
  LoaderCircle,
  Search,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { ZeroHash } from "ethers";

import { BOT_CHAIN, contractExplorerUrl } from "../../config/network";
import { readIntent } from "../../lib/blockchain/contract";
import { logDevelopmentError, toUserError } from "../../lib/errors";
import { formatTimestamp } from "../../lib/format";
import { getStoredIntent } from "../../lib/storage/intents";
import type { OnChainIntent, SealedIntentRecord } from "../../types/intent";

export function VerifyPage() {
  const [intentId, setIntentId] = useState("");
  const [result, setResult] = useState<OnChainIntent | null>(null);
  const [localRecord, setLocalRecord] = useState<SealedIntentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(event: FormEvent) {
    event.preventDefault();
    const normalizedId = intentId.trim();
    if (!/^\d+$/.test(normalizedId) || BigInt(normalizedId) < 1n) {
      setResult(null);
      setError("Enter a valid intent ID greater than zero.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const onChainIntent = await readIntent(BigInt(normalizedId));
      setResult(onChainIntent);
      setLocalRecord(getStoredIntent(BigInt(normalizedId).toString()));
    } catch (readError) {
      logDevelopmentError("Intent lookup failed", readError);
      setLocalRecord(null);
      setError(toUserError(readError, "read"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-h-[calc(100vh-129px)] max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400"><Search size={18} /></div>
        <p className="eyebrow mt-6">On-chain lookup</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Verify an intent</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-500">Read the immutable proof and current outcome status directly from {BOT_CHAIN.chainName}. No wallet connection required.</p>
      </div>

      <form
        className="mx-auto mt-10 flex max-w-xl gap-2"
        noValidate
        onSubmit={(event) => void verify(event)}
      >
        <label className="sr-only" htmlFor="verify-id">Intent ID</label>
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-4 flex items-center font-mono text-xs text-zinc-700">#</span>
          <input
            id="verify-id"
            inputMode="numeric"
            pattern="[0-9]*"
            className="input h-11 pl-8"
            placeholder="Enter intent ID"
            value={intentId}
            onChange={(event) => setIntentId(event.target.value)}
          />
        </div>
        <button className="button button-primary h-11 px-5" disabled={loading}>
          {loading ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowRight size={15} />}
          <span className="hidden sm:inline">Verify</span>
        </button>
      </form>

      {error && (
        <div className="mx-auto mt-5 flex max-w-xl gap-2.5 rounded-lg border border-red-400/15 bg-red-400/[0.05] p-3 text-xs leading-5 text-red-200"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</div>
      )}

      {result && (
        <div className="mx-auto mt-10 max-w-3xl panel overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-emerald-400/10 text-emerald-400"><CheckCircle2 size={17} /></div>
              <div><p className="text-sm font-medium text-white">Intent #{BigInt(intentId.trim()).toString()}</p><p className="mt-1 text-xs text-zinc-600">Found on BOT Chain Testnet</p></div>
            </div>
            <span className={`self-start rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] ${result.completed ? "border-blue-400/20 bg-blue-400/[0.07] text-blue-300" : "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300"}`}>
              {result.completed ? "COMPLETED" : "OPEN"}
            </span>
          </div>
          <dl className="divide-y divide-white/[0.06] px-5 sm:px-7">
            <VerifyRow label="Creator" value={result.creator} mono />
            <VerifyRow label="Intent hash" value={result.intentHash} mono />
            <VerifyRow label="Created" value={formatTimestamp(result.createdAt)} icon={<Clock3 size={13} />} />
            <VerifyRow label="Outcome hash" value={result.outcomeHash === ZeroHash ? "Not recorded" : result.outcomeHash} mono={result.outcomeHash !== ZeroHash} muted={result.outcomeHash === ZeroHash} />
            <VerifyRow label="Completed" value={result.completedAt === 0n ? "Not completed" : formatTimestamp(result.completedAt)} muted={result.completedAt === 0n} />
          </dl>
          {localRecord && (
            <div className="m-5 rounded-xl border border-white/[0.07] bg-black/20 p-4 sm:m-7">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-300"><FileKey2 size={14} className="text-emerald-400" /> Local intent available</div>
              <p className="mt-2 text-xs leading-5 text-zinc-600">The full canonical payload is stored as local application data in this browser and matches this intent ID.</p>
              <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-3 font-mono text-[10px] leading-5 text-zinc-500">{localRecord.canonicalPayload}</pre>
            </div>
          )}
          <div className="border-t border-white/[0.07] p-5 sm:p-7">
            <a className="inline-flex items-center gap-2 text-xs text-zinc-500 transition hover:text-white" href={contractExplorerUrl()} target="_blank" rel="noreferrer">View source contract <ExternalLink size={12} /></a>
          </div>
        </div>
      )}
    </div>
  );
}

function VerifyRow({ label, value, mono = false, muted = false, icon }: { label: string; value: string; mono?: boolean; muted?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[120px_1fr] sm:items-center">
      <dt className="text-xs text-zinc-600">{label}</dt>
      <dd className={`flex min-w-0 items-center gap-2 break-all text-xs ${mono ? "font-mono" : ""} ${muted ? "text-zinc-700" : "text-zinc-400"}`}>{icon}{value}</dd>
    </div>
  );
}
