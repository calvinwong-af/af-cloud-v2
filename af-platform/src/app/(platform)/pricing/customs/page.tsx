/**
 * /pricing/customs — Customs Clearance
 */

import { ClipboardList } from 'lucide-react';
import { CustomsRatesTab } from './_customs-table';

export default function CustomsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-semibold text-[var(--text)]">Customs Clearance</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Customs clearance rates by country, trade direction, and shipment type
        </p>
      </div>

      <CustomsRatesTab countryCode="MY" />
    </div>
  );
}
