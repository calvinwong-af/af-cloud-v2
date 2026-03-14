'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { listAllQuotationsAction } from '@/app/actions/quotations';
import type { Quotation } from '@/app/actions/quotations';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-[rgba(59,158,255,0.1)] text-[var(--sky)]',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
  EXPIRED: 'bg-amber-100 text-amber-700',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function QuotationsList() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await listAllQuotationsAction();
        if (!result) { setError('No response'); setLoading(false); return; }
        if (result.success) {
          setQuotations(result.data);
        } else {
          setError(result.error);
        }
      } catch {
        setError('Failed to load quotations');
      }
      setLoading(false);
    })();
  }, []);

  if (error) {
    return (
      <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Ref</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Shipment</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Rev</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Created</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Created By</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-[var(--surface)] rounded animate-pulse" style={{ width: j === 0 ? '120px' : j === 5 ? '160px' : '80px' }} />
                  </td>
                ))}
              </tr>
            ))
          ) : quotations.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                  <FileText className="w-8 h-8 opacity-40" />
                  <p className="text-sm">No quotations yet</p>
                </div>
              </td>
            </tr>
          ) : (
            quotations.map(q => (
              <tr key={q.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)]/50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/quotations/${q.quotation_ref}`}
                    target="_blank"
                    className="font-mono text-xs font-medium text-[var(--sky)] hover:underline"
                  >
                    {q.quotation_ref}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text)]" title={q.shipment_id}>
                  {q.shipment_id.length > 8 ? q.shipment_id.slice(0, 8) + '…' : q.shipment_id}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[q.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text)]">#{q.revision}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{formatDate(q.created_at)}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)] truncate max-w-[200px]">{q.created_by}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
