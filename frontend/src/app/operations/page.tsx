import { getDeploymentManifest, getOperationalBatch } from "@/lib/data";
import OperationalHistory from "@/components/OperationalHistory";
import { formatPeso } from "@/lib/format";

const labels: Record<string, string> = { lag_reg: "Lag-Informed Regression", arima: "ARIMA", lstm: "LSTM" };

export default async function OperationsPage() {
  const [manifest, batch] = await Promise.all([getDeploymentManifest(), getOperationalBatch()]);
  if (!manifest) return <p>Deployment manifest unavailable. Operational forecasts are disabled.</p>;
  return <div className="space-y-6">
    <h1 className="text-3xl font-bold text-white">Operational deployment</h1>
    <p>{manifest.promotion_id} · {manifest.approval.status} · {manifest.promotion_date} · manual local generation</p>
    <p>Frozen configurations from {manifest.formal_run_id}. Each run refits on the latest validated official data without model selection or retuning.</p>
    <p>{batch ? `First issue: ${batch.promotionBoundary.firstIssuedAt}; first target session: ${batch.promotionBoundary.firstTargetDate}.`
      : "No full operational batch has been generated. No post-promotion forecast accuracy is available."}</p>
    <p>Legacy predictions remain on company pages with their original provenance. Study holdout predictions never become live operational history.
      <a href="/compare" className="ml-1 underline">Read the immutable Formal Study Results.</a></p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="text-left mb-3">All 15 approved configurations and latest issued next-session forecasts</caption>
      <thead><tr><th className="p-2">Company</th><th className="p-2">Selected model</th><th className="p-2">Next close</th><th className="p-2">Target session</th><th className="p-2">Data through</th></tr></thead>
      <tbody>{Object.entries(manifest.companies).map(([symbol, item]) => {
        const forecast = batch?.forecasts[symbol];
        return <tr key={symbol} className="border-t border-slate-700"><th className="p-2"><a href={`/companies/${symbol}`}>{symbol}</a></th>
          <td className="p-2">{labels[item.model]}</td><td className="p-2">{forecast ? formatPeso(forecast.predictedClose) : "Awaiting generation"}</td>
          <td className="p-2">{forecast?.forecastFor ?? "—"}</td><td className="p-2">{forecast?.dataAsOf ?? "—"}</td></tr>;
      })}</tbody>
    </table></div>
    <OperationalHistory history={batch?.history ?? []} />
  </div>;
}
