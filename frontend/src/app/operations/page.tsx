import { getDeploymentManifest, getOperationalBatch } from "@/lib/data";
import OperationalHistory from "@/components/OperationalHistory";
import { formatPeso } from "@/lib/format";

const labels: Record<string, string> = { lag_reg: "Lag-Informed Regression", arima: "ARIMA", lstm: "LSTM" };

export default async function OperationsPage() {
  const [manifest, batch] = await Promise.all([getDeploymentManifest(), getOperationalBatch()]);
  if (!manifest) return <p>Deployment manifest unavailable. Operational forecasts are disabled.</p>;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">Operational Deployment</h1>
        <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center gap-3 text-xs font-mono text-slate-300">
          <span className="rounded-md border border-accent-emerald/30 bg-accent-emerald/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-accent-emerald">
            {manifest.promotion_id}
          </span>
          <span className="text-slate-500">•</span>
          <span>Status: <strong className="text-white font-semibold">{manifest.approval.status}</strong></span>
          <span className="text-slate-500">•</span>
          <span>Promoted: {manifest.promotion_date}</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">manual local generation</span>
        </div>
      </div>

      <div className="glass-card p-5 rounded-xl shadow-card-glow text-xs sm:text-sm text-slate-300 space-y-2 leading-relaxed">
        <p>
          Frozen configurations from <code className="text-neon-300 font-mono">{manifest.formal_run_id}</code>. Each run refits on the latest validated official data without model selection or retuning.
        </p>
        <p>
          {batch
            ? `First issue: ${batch.promotionBoundary.firstIssuedAt}; first target session: ${batch.promotionBoundary.firstTargetDate}.`
            : "No full operational batch has been generated. No post-promotion forecast accuracy is available."}
        </p>
        <p className="text-xs text-slate-400 pt-1 border-t border-charcoal-700/60">
          Legacy predictions remain on company pages with their original provenance. Study holdout predictions never become live operational history.
          <a href="/compare" className="ml-1 text-neon-400 hover:text-neon-300 font-mono underline font-medium">Read the immutable Formal Study Results →</a>
        </p>
      </div>

      <div className="glass-card p-6 rounded-xl shadow-card-glow overflow-x-auto">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3">
          All 15 approved configurations and latest issued next-session forecasts
        </h3>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-400 uppercase font-mono bg-charcoal-900/90 border-b border-charcoal-700">
            <tr>
              <th className="py-2.5 px-3">Company</th>
              <th className="py-2.5 px-3">Selected model</th>
              <th className="py-2.5 px-3 text-right">Next close</th>
              <th className="py-2.5 px-3">Target session</th>
              <th className="py-2.5 px-3">Data through</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(manifest.companies).map(([symbol, item]) => {
              const forecast = batch?.forecasts[symbol];
              return (
                <tr key={symbol} className="border-b border-charcoal-800 hover:bg-charcoal-850/40 transition-colors font-mono">
                  <th className="py-2.5 px-3 font-bold text-white">
                    <a href={`/companies/${symbol}`} className="hover:text-neon-400 transition-colors">
                      {symbol}
                    </a>
                  </th>
                  <td className="py-2.5 px-3 text-slate-300 text-xs">{labels[item.model]}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">
                    {forecast ? formatPeso(forecast.predictedClose) : <span className="text-slate-500 font-normal">Awaiting generation</span>}
                  </td>
                  <td className="py-2.5 px-3 text-neon-300 text-xs">{forecast?.forecastFor ?? "—"}</td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs">{forecast?.dataAsOf ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <OperationalHistory history={batch?.history ?? []} />
    </div>
  );
}
