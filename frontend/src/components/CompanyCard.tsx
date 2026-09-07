import Link from "next/link";
import ChangeBadge from "./ChangeBadge";
import CompanyLogo from "./CompanyLogo";
import WatchlistStar from "./watchlist/WatchlistStar";
import { formatDate, formatPeso } from "@/lib/format";
import type { CompanySummary } from "@/lib/types";

export default function CompanyCard({ company }: { company: CompanySummary }) {
  return (
    <article className="relative glass-card rounded-xl p-5 hover:border-neon-400/50 hover:shadow-neon-sm hover:-translate-y-0.5 transition-all duration-300 shadow-card-glow space-y-3 group cursor-pointer">
      {/* Full Card Clickable Overlay */}
      <Link
        href={`/companies/${company.symbol}`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-neon-400"
        aria-label={`View ${company.symbol} - ${company.name} stock forecast`}
      />

      {/* Header Row: Symbol, Logo & Watchlist Star / Change Badge */}
      <div className="relative z-10 pointer-events-none flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CompanyLogo symbol={company.symbol} name={company.name} size="md" />
          <p className="font-bold text-slate-900 dark:text-white text-lg font-mono leading-tight group-hover:text-cyan-600 dark:group-hover:text-neon-300 transition-colors">
            {company.symbol}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto">
          <WatchlistStar symbol={company.symbol} showLabel size="sm" />
          <ChangeBadge pctChange={company.pctChange} />
        </div>
      </div>

      {/* Company Name */}
      <div className="relative z-10 pointer-events-none min-h-10 text-sm leading-snug text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
        {company.name}
      </div>

      {/* Details Row: Forecasted Close and Sector/Date (Selected Model REMOVED) */}
      <div className="relative z-10 pointer-events-none pt-3 border-t border-slate-200 dark:border-charcoal-700/60 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500 font-medium">Forecasted Close</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white font-mono tracking-tight">
            {formatPeso(company.predictedClose)}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-700 text-slate-600 dark:text-slate-400 font-mono font-medium">
            {company.sector}
          </span>
          {company.forecastDate && (
            <span className="text-slate-400 font-mono text-[11px]">
              For {formatDate(company.forecastDate)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
