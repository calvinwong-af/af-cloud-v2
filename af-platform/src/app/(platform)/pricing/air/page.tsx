/**
 * /pricing/air — Air Freight Rate Cards
 */

import { Plane } from 'lucide-react';
import { AirRateCardsTab } from './_air-rate-cards-tab';

export default function AirFreightPage({
  searchParams,
}: {
  searchParams: { country?: string; alerts?: string };
}) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Plane className="w-5 h-5 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-semibold text-[var(--text)]">Air Freight</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Air freight rate cards and pricing history
        </p>
      </div>

      <AirRateCardsTab countryCode={searchParams.country ?? 'MY'} alertFilter={searchParams.alerts} />
    </div>
  );
}
