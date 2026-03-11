/**
 * /pricing/haulage — Haulage Rate Cards
 */

import { Truck } from 'lucide-react';
import { HaulageRateCardsTab } from './_haulage-rate-cards-tab';

export default function HaulagePage({
  searchParams,
}: {
  searchParams: { country?: string; alerts?: string };
}) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-semibold text-[var(--text)]">Haulage</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Port-to-area haulage rate cards and pricing history
        </p>
      </div>

      <HaulageRateCardsTab countryCode={searchParams.country ?? 'MY'} alertFilter={searchParams.alerts} />
    </div>
  );
}
