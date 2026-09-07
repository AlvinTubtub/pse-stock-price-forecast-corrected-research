import Link from "next/link";
import { ModernSquircleBadge } from "@/components/ModernIcon";

export default function NotFound() {
  return (
    <div className="text-center py-20 flex flex-col items-center">
      <div className="mb-6">
        <ModernSquircleBadge icon="trendingDown" color="cyan" size="lg" className="scale-125" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Not found</h1>
      <p className="text-slate-400 mb-6">That page or ticker doesn&apos;t exist in the forecast data.</p>
      <Link href="/" className="text-neon-400 hover:text-neon-300 font-mono text-sm">
        ← Back home
      </Link>
    </div>
  );
}
