"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import CompanyLogo from "@/components/CompanyLogo";
import ModernIcon from "@/components/ModernIcon";
import type { CompanySummary } from "@/lib/types";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/companies", label: "Companies" },
  { href: "/watchlist", label: "My Watchlist" },
  { href: "/compare", label: "Models" },
  { href: "/learn-stocks", label: "Learn Stocks" },
  { href: "/about", label: "About" },
];

export default function Navbar({
  companies,
}: {
  companies: CompanySummary[];
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    if (!query.trim()) return [];

    const q = query.toLowerCase();

    return companies
      .filter(
        (c) =>
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [query, companies]);

  function goTo(url: string) {
    setQuery("");
    window.location.assign(url);
  }

  return (
    <nav className="fixed top-0 w-full glass-panel z-50 border-b border-charcoal-700/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a
            href="/"
            className="flex items-center gap-3 transition-transform hover:scale-[1.02] select-none"
            aria-label="ForecastPH - PSE Stock Forecasting"
          >
            {/* Logo Icon Squircle */}
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-charcoal-900 border border-neon-400/50 flex items-center justify-center shadow-neon-sm shrink-0">
              {/* Cyan Live Notification Dot at top-right */}
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-neon-400 shadow-[0_0_8px_#00f0ff] ring-2 ring-charcoal-950 dark:ring-charcoal-950" />
              {/* Upward Trending Chart Arrow */}
              <svg
                className="w-5 h-5 text-neon-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>

            {/* Logo Text */}
            <div className="flex flex-col justify-center">
              <span className="font-extrabold text-xl text-white tracking-tight leading-none flex items-baseline">
                Forecast<span className="text-neon-400 ml-1 text-neon-glow">PH</span>
              </span>
              <span className="font-mono text-[9px] sm:text-[10px] tracking-widest text-slate-400 uppercase font-semibold leading-none mt-1">
                PSE STOCK FORECASTING
              </span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-baseline space-x-1.5">
            {LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider font-semibold transition-all ${
                    active
                      ? "bg-neon-500/10 text-neon-400 border border-neon-400/30 shadow-neon-sm"
                      : "text-slate-400 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>

          {/* Search + Theme */}
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <ModernIcon name="search" className="w-3.5 h-3.5 text-slate-400" />
              </div>

              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block w-48 lg:w-64 pl-9 pr-3 py-1.5 border border-charcoal-700 rounded-full leading-5 bg-charcoal-900/90 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-neon-400 focus:border-neon-400 font-mono sm:text-xs transition-all shadow-inner"
                placeholder="Search symbol or name..."
              />

              {matches.length > 0 && (
                <div className="absolute mt-1 w-full glass-card rounded-lg shadow-card-glow z-50 max-h-60 overflow-y-auto border border-charcoal-700">
                  {matches.map((company) => (
                    <button
                      key={company.symbol}
                      type="button"
                      onClick={() =>
                        goTo(`/companies/${company.symbol}`)
                      }
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors flex items-center gap-2.5"
                    >
                      <CompanyLogo symbol={company.symbol} size="xs" />
                      <div className="truncate min-w-0">
                        <span className="font-semibold text-white font-mono">
                          {company.symbol}
                        </span>
                        <span className="text-slate-400 text-xs">
                          {" "}
                          — {company.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}