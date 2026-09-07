import { formatPct } from "@/lib/format";
import ModernIcon from "@/components/ModernIcon";

export default function ChangeBadge({ pctChange }: { pctChange: number }) {
  const positive = pctChange >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${
        positive
          ? "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20"
          : "bg-accent-rose/10 text-accent-rose border-accent-rose/20"
      }`}
    >
      <ModernIcon
        name={positive ? "arrowUpRight" : "arrowDownRight"}
        className="w-3 h-3 shrink-0"
      />
      {formatPct(pctChange)}
    </span>
  );
}
