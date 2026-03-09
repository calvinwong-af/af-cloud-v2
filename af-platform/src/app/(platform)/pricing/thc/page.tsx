/**
 * /pricing/thc — THC & Local Charges
 */

import { Warehouse } from 'lucide-react';
import { THCTable } from './_thc-table';

export default function THCPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Warehouse className="w-5 h-5 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-semibold text-[var(--text)]">THC & Local Charges</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Terminal handling charges by port, direction, and shipment type
        </p>
      </div>

      <THCTable />
    </div>
  );
}
