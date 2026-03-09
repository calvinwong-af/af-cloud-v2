import { Warehouse } from 'lucide-react';
import { LocalChargesTab } from './_local-charges-table';

export default async function LocalChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; alerts?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sky-mist)] flex items-center justify-center">
          <Warehouse size={20} className="text-[var(--sky)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[var(--text)]">Local Charges</h1>
          <p className="text-xs text-[var(--text-muted)]">Port-level charges — THC, documentation, handling, etc.</p>
        </div>
      </div>
      <LocalChargesTab countryCode="MY" alertFilter={params.alerts} />
    </div>
  );
}
