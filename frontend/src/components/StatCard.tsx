export default function StatCard({
  label,
  value,
  sublabel,
  accent = "text-white",
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: string;
}) {
  return (
    <div className="glass-card rounded-xl p-5 shadow-card-glow hover:border-neon-400/30 transition-all">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">{label}</p>
      <p className={`text-3xl font-bold font-mono tracking-tight mb-1 ${accent}`}>{value}</p>
      {sublabel && <p className="text-xs text-slate-400 leading-snug">{sublabel}</p>}
    </div>
  );
}
