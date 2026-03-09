/**
 * /pricing/transportation — Transport Rate Cards
 */

import { Car } from 'lucide-react';
import { PortTransportRateCardsTab } from './_port-transport-rate-cards-tab';

export default function TransportationPage({
  searchParams,
}: {
  searchParams: { country?: string; alerts?: string };
}) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-semibold text-[var(--text)]">Transportation</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Port-to-area transport rate cards and pricing history
        </p>
      </div>

      <PortTransportRateCardsTab countryCode={searchParams.country ?? 'MY'} alertFilter={searchParams.alerts} />
    </div>
  );
}
