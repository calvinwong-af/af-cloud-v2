/**
 * /pricing/lcl — LCL Rate Cards
 */

import { Package } from 'lucide-react';
import { LCLRateCardsTab } from '../_components';

export default function LCLPage({
  searchParams,
}: {
  searchParams: { country?: string };
}) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-semibold text-[var(--text)]">LCL Ocean Freight</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Less than container load rate cards and pricing history
        </p>
      </div>

      <LCLRateCardsTab countryCode={searchParams.country} />
    </div>
  );
}
