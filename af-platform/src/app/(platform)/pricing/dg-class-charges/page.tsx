import { FlaskConical } from 'lucide-react';
import { DgClassChargesTab } from './_dg-class-charges-table';

export default async function DgClassChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; alerts?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sky-mist)] flex items-center justify-center">
          <FlaskConical size={20} className="text-[var(--sky)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[var(--text)]">DG Class Charges</h1>
          <p className="text-xs text-[var(--text-muted)]">DG-specific port charges — inspection, handling, hazmat</p>
        </div>
      </div>
      <DgClassChargesTab countryCode="MY" alertFilter={params.alerts} />
    </div>
  );
}
