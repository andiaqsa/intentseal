import { ArrowRight, Braces, Check, Fingerprint, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { BOT_CHAIN, contractExplorerUrl } from "../../config/network";

const steps = [
  {
    number: "01",
    title: "Define",
    copy: "Write the goal and the measurable criteria that make success unambiguous.",
    icon: Braces,
  },
  {
    number: "02",
    title: "Seal",
    copy: "Create a deterministic hash and timestamp the proof on BOT Chain.",
    icon: Fingerprint,
  },
  {
    number: "03",
    title: "Prove",
    copy: "Later, compare the finished outcome against what existed beforehand.",
    icon: ShieldCheck,
  },
];

export function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/[0.07]">
        <div className="hero-grid absolute inset-0 opacity-40" />
        <div className="hero-glow absolute left-1/2 top-0 h-[520px] w-[720px] -translate-x-1/2" />
        <div className="relative mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:py-40">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-1.5 text-[11px] font-medium text-emerald-300">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            Live on {BOT_CHAIN.chainName}
          </div>
          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-white sm:text-6xl lg:text-[72px]">
            Prove what was intended before the outcome existed.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-zinc-400 sm:text-lg">
            Seal a cryptographic proof of your intent on BOT Chain before the work begins. Precise, timestamped, and independently verifiable.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link className="button button-primary h-11 px-5" to="/create">
              Create an intent <ArrowRight size={15} />
            </Link>
            <a className="button button-secondary h-11 px-5" href="#how-it-works">
              How it works
            </a>
          </div>

          <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-white/[0.09] bg-[#0d0f10]/90 p-2 text-left shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
              <div className="flex gap-1.5"><span className="window-dot" /><span className="window-dot" /><span className="window-dot" /></div>
              <span className="font-mono text-[10px] text-zinc-600">intentseal.intent.v1</span>
            </div>
            <div className="grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:p-8">
              <div>
                <p className="eyebrow">Intent preview</p>
                <h2 className="mt-3 text-lg font-medium text-zinc-100">Add API rate limiting</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">Implement login endpoint rate limiting before completing the task.</p>
                <div className="mt-5 space-y-2.5">
                  {["Maximum 5 attempts per minute per IP", "Return HTTP 429 when exceeded", "Add automated tests"].map((item) => (
                    <div key={item} className="flex items-center gap-2.5 text-xs text-zinc-400">
                      <span className="grid size-4 place-items-center rounded-full bg-emerald-400/10 text-emerald-400"><Check size={10} /></span>{item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex min-w-40 flex-col justify-between rounded-xl border border-white/[0.07] bg-black/20 p-4">
                <Fingerprint size={20} className="text-emerald-400" />
                <div className="mt-8">
                  <p className="eyebrow">Proof state</p>
                  <p className="mt-1.5 text-sm font-medium text-white">Ready to seal</p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-600">0x7f2a…91c4</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="max-w-xl">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">A clean chain of evidence.</h2>
          <p className="mt-4 text-sm leading-6 text-zinc-500">The full intent stays with you. Only its cryptographic fingerprint is written on-chain.</p>
        </div>
        <div className="mt-12 grid border-y border-white/[0.07] md:grid-cols-3">
          {steps.map(({ number, title, copy, icon: Icon }, index) => (
            <article key={title} className={`group py-8 md:px-8 ${index > 0 ? "border-t border-white/[0.07] md:border-l md:border-t-0" : "md:pl-0"}`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-zinc-700">{number}</span>
                <Icon size={18} className="text-zinc-600 transition group-hover:text-emerald-400" />
              </div>
              <h3 className="mt-10 text-base font-medium text-zinc-100">{title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-500">{copy}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-2 text-xs text-zinc-600">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Contract deployed on BOT Chain Testnet
          <a className="ml-1 text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-white" href={contractExplorerUrl()} target="_blank" rel="noreferrer">View contract</a>
        </div>
      </section>
    </>
  );
}
