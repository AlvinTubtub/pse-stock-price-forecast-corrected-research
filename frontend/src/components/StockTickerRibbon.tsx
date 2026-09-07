import Link from "next/link";
import { formatPeso } from "@/lib/format";
import type { CompanySummary } from "@/lib/types";

interface StockTickerRibbonProps {
  companies: CompanySummary[];
}

export default function StockTickerRibbon({ companies }: StockTickerRibbonProps) {
  if (!companies || companies.length === 0) {
    return null;
  }

  const renderCard = (company: CompanySummary, suffix: string, isDuplicate = false) => {
    const isHighlighted = company.symbol === "BPI";

    return (
      <Link
        key={`${company.symbol}-${suffix}`}
        href={`/companies/${company.symbol}`}
        tabIndex={isDuplicate ? -1 : 0}
        aria-label={`${company.symbol} (${company.sector}): Close ${formatPeso(company.latestClose)}, Next-Day ${formatPeso(company.predictedClose)}`}
        className={`inline-flex items-center gap-3.5 px-4 py-2 rounded-xl transition-all duration-200 shrink-0 select-none group/card ${
          isHighlighted
            ? "bg-white dark:bg-charcoal-900/95 border border-cyan-500/60 dark:border-neon-500/60 shadow-[0_0_15px_rgba(2,132,199,0.18)] dark:shadow-[0_0_15px_rgba(0,240,255,0.18)]"
            : "bg-white dark:bg-charcoal-900/85 border border-slate-200 dark:border-charcoal-800 hover:border-cyan-500/60 dark:hover:border-neon-400/60 hover:shadow-md dark:hover:shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:bg-slate-50 dark:hover:bg-charcoal-850"
        }`}
      >
        {/* Company Ticker */}
        <span className="font-mono font-bold text-slate-900 dark:text-white text-sm tracking-wide group-hover/card:text-cyan-600 dark:group-hover/card:text-neon-400 transition-colors">
          {company.symbol}
        </span>

        {/* Sector Badge */}
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-charcoal-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-charcoal-700/50">
          {company.sector}
        </span>

        {/* Close Price */}
        <div className="flex items-baseline gap-1 font-mono text-xs">
          <span className="text-slate-500 dark:text-slate-400">Close:</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {formatPeso(company.latestClose)}
          </span>
        </div>

        {/* Next-Day Forecast Price */}
        <div className="flex items-baseline gap-1 font-mono text-xs">
          <span className="text-slate-500 dark:text-slate-400">Next-Day:</span>
          <span className="font-bold text-cyan-600 dark:text-neon-400">
            {formatPeso(company.predictedClose)}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <section
      className="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] py-3.5 bg-slate-100/90 dark:bg-charcoal-950/90 border-y border-slate-200 dark:border-charcoal-800/80 overflow-hidden"
      aria-label="Live PSE stock price forecast ticker"
    >
      {/* Gradient fade edge masks */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-r from-slate-100 via-slate-100/90 dark:from-charcoal-950 dark:via-charcoal-950/80 to-transparent z-10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-l from-slate-100 via-slate-100/90 dark:from-charcoal-950 dark:via-charcoal-950/80 to-transparent z-10"
        aria-hidden="true"
      />

      {/* Marquee Track with infinite continuous scrolling and pause-on-hover */}
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused] items-center gap-4">
        {/* Set 1 */}
        <div className="flex items-center gap-4 shrink-0">
          {companies.map((company) => renderCard(company, "1", false))}
        </div>

        {/* Set 2 (exact duplicate for seamless infinite loop) */}
        <div className="flex items-center gap-4 shrink-0" aria-hidden="true">
          {companies.map((company) => renderCard(company, "2", true))}
        </div>
      </div>
    </section>
  );
}
