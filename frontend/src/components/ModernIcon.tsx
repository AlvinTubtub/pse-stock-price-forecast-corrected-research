import React from "react";

export type IconName =
  | "bank"
  | "zap"
  | "pickaxe"
  | "building"
  | "signal"
  | "globe"
  | "trendingUp"
  | "trendingDown"
  | "scale"
  | "graduationCap"
  | "inbox"
  | "cog"
  | "brain"
  | "target"
  | "shieldCheck"
  | "shieldAlert"
  | "microscope"
  | "calculator"
  | "barChart"
  | "lineChart"
  | "bookOpen"
  | "fileText"
  | "calendar"
  | "video"
  | "alertTriangle"
  | "search"
  | "check"
  | "star"
  | "starOutline"
  | "x"
  | "arrowUp"
  | "arrowDown"
  | "arrowUpRight"
  | "arrowDownRight";

interface ModernIconProps {
  name: IconName;
  className?: string;
  size?: number;
}

export default function ModernIcon({ name, className = "w-4 h-4", size }: ModernIconProps) {
  const sizeProps = size ? { width: size, height: size } : {};

  switch (name) {
    case "bank":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M12 3L2 8h20L12 3z" />
        </svg>
      );
    case "zap":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "pickaxe":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 9.5l-9 9M18 6l-3-3a13.9 13.9 0 00-9.9 4.1L3 9l3 3 1.9-2.1A13.9 13.9 0 0118 6zM15 15l6 6" />
        </svg>
      );
    case "building":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m-1 4h1m5-8h1m-1 4h1m-1 4h1" />
        </svg>
      );
    case "signal":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a10 10 0 0114.142 0M1.404 9.404a15 15 0 0121.192 0" />
        </svg>
      );
    case "globe":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
      );
    case "trendingUp":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case "trendingDown":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      );
    case "scale":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3-1m0 0l-3 9a5.002 5.002 0 006.001 0M18 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M21 7l3-1m0 0l-3 9a5.002 5.002 0 006.001 0M12 3v18" />
        </svg>
      );
    case "graduationCap":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      );
    case "inbox":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-4.5a2.5 2.5 0 01-2.5 2.5h-2a2.5 2.5 0 01-2.5-2.5H4" />
        </svg>
      );
    case "cog":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "brain":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case "target":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
        </svg>
      );
    case "shieldCheck":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "shieldAlert":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "microscope":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      );
    case "calculator":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" strokeLinecap="round" />
          <line x1="16" y1="14" x2="16" y2="18" strokeLinecap="round" />
          <circle cx="8" cy="11" r="1" fill="currentColor" />
          <circle cx="12" cy="11" r="1" fill="currentColor" />
          <circle cx="16" cy="11" r="1" fill="currentColor" />
          <circle cx="8" cy="15" r="1" fill="currentColor" />
          <circle cx="12" cy="15" r="1" fill="currentColor" />
          <circle cx="8" cy="18" r="1" fill="currentColor" />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
      );
    case "barChart":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case "lineChart":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M3 3v18h18" />
        </svg>
      );
    case "bookOpen":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case "fileText":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "video":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case "alertTriangle":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "search":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case "check":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case "star":
      return (
        <svg className={className} {...sizeProps} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    case "starOutline":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      );
    case "x":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case "arrowUp":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      );
    case "arrowDown":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      );
    case "arrowUpRight":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7V17" />
        </svg>
      );
    case "arrowDownRight":
      return (
        <svg className={className} {...sizeProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l10 10M17 17H7M17 17V7" />
        </svg>
      );
    default:
      return null;
  }
}

interface ModernSquircleBadgeProps {
  icon: IconName;
  color?: "cyan" | "emerald" | "amber" | "purple" | "blue" | "slate" | "red";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ModernSquircleBadge({
  icon,
  color = "cyan",
  size = "md",
  className = "",
}: ModernSquircleBadgeProps) {
  const sizeClasses = {
    sm: "w-7 h-7 rounded-lg",
    md: "w-9 h-9 rounded-xl",
    lg: "w-11 h-11 rounded-2xl",
  }[size];

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  }[size];

  const colorClasses = {
    cyan: "bg-cyan-500/10 border-cyan-400/30 text-neon-400 shadow-[0_0_10px_rgba(0,240,255,0.15)]",
    emerald: "bg-emerald-500/10 border-emerald-400/30 text-accent-emerald shadow-[0_0_10px_rgba(0,245,155,0.15)]",
    amber: "bg-amber-500/10 border-amber-400/30 text-accent-amber shadow-[0_0_10px_rgba(255,184,0,0.15)]",
    purple: "bg-purple-500/10 border-purple-400/30 text-[#c084fc] shadow-[0_0_10px_rgba(168,85,247,0.15)]",
    blue: "bg-blue-500/10 border-blue-400/30 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]",
    slate: "bg-slate-500/10 border-slate-400/30 text-slate-300",
    red: "bg-rose-500/10 border-rose-400/30 text-accent-red shadow-[0_0_10px_rgba(255,59,48,0.15)]",
  }[color];

  return (
    <div
      className={`inline-flex items-center justify-center border shrink-0 transition-transform duration-200 ${sizeClasses} ${colorClasses} ${className}`}
    >
      <ModernIcon name={icon} className={iconSizes} />
    </div>
  );
}
