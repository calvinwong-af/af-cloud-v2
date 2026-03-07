/**
 * /pricing — Pricing Dashboard
 * AFU only — sidebar restricts visibility.
 */

import { Grid3X3 } from 'lucide-react';
import { PricingDashboard } from './_components';

export default function PricingPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-semibold text-[var(--text)]">Pricing Tables</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Manage rate cards and pricing across all freight components
        </p>
      </div>

      <PricingDashboard />
    </div>
  );
}
