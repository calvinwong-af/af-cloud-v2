import { FileText } from 'lucide-react';
import { QuotationsList } from './_components';

export default function QuotationsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-semibold text-[var(--text)]">Quotations</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          View and manage freight quotations
        </p>
      </div>
      <QuotationsList />
    </div>
  );
}
