import { ArrowRight, Check, ExternalLink, FileSearch, Fingerprint, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { BOT_CHAIN, contractExplorerUrl } from "../../config/network";

const steps = [
  { number: "01", title: "Seal Before", copy: "Define the goal and success criteria, then anchor the intent hash on BOT Chain.", icon: Fingerprint },
  { number: "02", title: "Attach Evidence", copy: "Lock finished work to one exact GitHub commit and inspect criterion-level evidence.", icon: FileSearch },
  { number: "03", title: "Prove After", copy: "Seal the reviewed outcome and verify the complete chronology publicly.", icon: ShieldCheck },
];

export function HomePage() {
  return <>
    <section className="relative overflow-hidden border-b border-white/[0.07]">
      <div className="hero-grid absolute inset-0 opacity-40" />
      <div className="hero-glow absolute left-1/2 top-0 h-[520px] w-[720px] -translate-x-1/2" />
      <div className="relative mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:py-36">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-1.5 text-[11px] font-medium text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-400" />Live on {BOT_CHAIN.chainName}</div>
        <h1 className="mx-auto max-w-4xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-white sm:text-6xl lg:text-[68px]">Prove what was intended before the outcome existed.</h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-zinc-400 sm:text-lg">Seal your intent before work begins. Bind the finished result to exact evidence. Verify the complete timeline on BOT Chain.</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"><Link className="button button-primary h-11 px-5" to="/create">Seal an intent <ArrowRight size={15} /></Link><Link className="button button-secondary h-11 px-5" to="/verify">Verify a proof</Link></div>

        <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-white/[0.09] bg-[#0d0f10]/90 p-2 text-left shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5"><div className="flex gap-1.5"><span className="window-dot" /><span className="window-dot" /><span className="window-dot" /></div><span className="font-mono text-[10px] text-zinc-600">BEFORE → EVIDENCE → AFTER</span></div>
          <div className="grid gap-0 p-5 sm:grid-cols-3 sm:p-8">
            {[{ label: "Before", title: "Intent sealed", meta: "T1 · intent hash" }, { label: "Evidence", title: "Exact commit locked", meta: "criterion evidence" }, { label: "After", title: "Outcome sealed", meta: "T2 · outcome hash" }].map((item, index) => <div key={item.label} className={`relative py-4 sm:px-5 ${index > 0 ? "border-t border-white/[0.07] sm:border-l sm:border-t-0" : ""}`}><p className="eyebrow">{item.label}</p><p className="mt-3 text-sm font-medium text-white">{item.title}</p><p className="mt-2 font-mono text-[10px] text-zinc-600">{item.meta}</p></div>)}
          </div>
        </div>
      </div>
    </section>

    <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="max-w-2xl"><p className="eyebrow">Proof of Prior Intent</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Promise before. Evidence after. Proof forever.</h2><p className="mt-4 text-sm leading-6 text-zinc-500">The blockchain proves chronology and integrity. GitHub provides immutable commit evidence. You review the evidence before any outcome is sealed.</p></div>
      <div className="mt-12 grid border-y border-white/[0.07] md:grid-cols-3">{steps.map(({ number, title, copy, icon: Icon }, index) => <article key={title} className={`group py-8 md:px-8 ${index > 0 ? "border-t border-white/[0.07] md:border-l md:border-t-0" : "md:pl-0"}`}><div className="flex items-center justify-between"><span className="font-mono text-[10px] text-zinc-700">{number}</span><Icon size={18} className="text-zinc-600 transition group-hover:text-emerald-400" /></div><h3 className="mt-10 text-base font-medium text-zinc-100">{title}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-zinc-500">{copy}</p></article>)}</div>
      <div className="mt-10 grid gap-5 md:grid-cols-2"><div className="panel p-6"><div className="flex items-center gap-2 text-sm font-medium text-white"><Check size={14} className="text-emerald-400" />What IntentSeal proves</div><p className="mt-3 text-sm leading-6 text-zinc-500">When intent and outcome hashes were recorded, that the records have not changed, and which exact GitHub commit supplied the reviewed evidence.</p></div><div className="panel p-6"><p className="text-sm font-medium text-white">Honest claim boundary</p><p className="mt-3 text-sm leading-6 text-zinc-500">IntentSeal does not prove that software is absolutely correct. It proves chronology, integrity, and provenance.</p></div></div>
      <div className="mt-8 flex flex-wrap items-center gap-2 text-xs text-zinc-600"><span className="size-1.5 rounded-full bg-emerald-500" />Secured by BOT Chain<a className="ml-1 inline-flex items-center gap-1 text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-white" href={contractExplorerUrl()} target="_blank" rel="noreferrer">View testnet contract <ExternalLink size={11} /></a></div>
    </section>
  </>;
}
