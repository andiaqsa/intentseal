import { Link } from "react-router-dom";

export function BrandMark() {
  return (
    <Link className="group inline-flex items-center gap-2.5" to="/" aria-label="IntentSeal home">
      <span className="relative grid size-7 place-items-center rounded-lg border border-white/15 bg-white/[0.06] shadow-inner">
        <span className="size-2.5 rotate-45 rounded-[2px] border border-emerald-300/90 transition-transform group-hover:rotate-[135deg]" />
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">IntentSeal</span>
    </Link>
  );
}
