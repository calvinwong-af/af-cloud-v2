'use client';

import type { GroundTransportOrder } from '@/app/actions/ground-transport';

const TRANSPORT_TYPE_STYLES: Record<string, string> = {
  haulage: 'bg-amber-100 text-amber-800',
  port: 'bg-blue-100 text-blue-800',
  general: 'bg-blue-100 text-blue-800',
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-800',
  dispatched: 'bg-sky-100 text-sky-800',
  in_transit: 'bg-amber-100 text-amber-800',
  detained: 'bg-orange-100 text-orange-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-700',
};

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '—';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

interface TransportOrderBadgeProps {
  order: GroundTransportOrder;
}

export default function TransportOrderBadge({ order }: TransportOrderBadgeProps) {
  const stops = order.stops ?? [];
  const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
  const first = sorted[0];
  const last = sorted.length >= 2 ? sorted[sorted.length - 1] : null;
  const legCount = (order.legs ?? []).length;

  return (
    <div className="border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)]">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => window.open(`/ground-transport/${order.order_id}`, '_blank')}
          className="text-xs font-mono text-[var(--sky)] hover:underline"
        >
          {order.order_id}
        </button>
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${TRANSPORT_TYPE_STYLES[order.transport_type] ?? 'bg-gray-100 text-gray-700'}`}>
          {order.transport_type.toUpperCase()}
        </span>
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
          {order.status.replace(/_/g, ' ')}
        </span>
        <span className="text-[10px] text-[var(--text-muted)] ml-auto">
          {legCount} {legCount === 1 ? 'leg' : 'legs'}
        </span>
      </div>
      {first && last && (
        <div className="text-[10px] text-[var(--text-muted)] mt-1 truncate">
          {truncate(first.address_line, 30)} → {truncate(last.address_line, 30)}
        </div>
      )}
    </div>
  );
}
