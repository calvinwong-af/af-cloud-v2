/**
 * /pricing/fcl — FCL Rate Cards
 */

import { Ship } from 'lucide-react';
import { FCLRateCardsTab } from '../_components';

export default function FCLPage({
  searchParams,
}: {
  searchParams: { country?: string };
}) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Ship className="w-5 h-5 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-semibold text-[var(--text)]">FCL Ocean Freight</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Full container load rate cards and pricing history
        </p>
      </div>

      <FCLRateCardsTab countryCode={searchParams.country ?? 'MY'} />
    </div>
  );
}
