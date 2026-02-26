/**
 * ShipmentOrderTable — displays the list of shipment orders
 *
 * Works with both V1 (assembled) and V2 records via the unified ShipmentOrder shape.
 * Status and order type indicators are derived from V2 status codes.
 */

'use client';

import { useRouter } from 'next/navigation';
import { MoreVertical, Ship, Plane, Truck, ArrowRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { ShipmentOrder } from '@/lib/types';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLOR, ORDER_TYPE_LABELS } from '@/lib/types';

interface ShipmentOrderTableProps {
  orders: ShipmentOrder[];
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  gray:   'bg-gray-100 text-gray-600',
  yellow: 'bg-yellow-100 text-yellow-700',
  blue:   'bg-blue-100 text-blue-700',
  orange: 'bg-orange-100 text-orange-700',
  teal:   'bg-teal-100 text-teal-700',
  sky:    'bg-sky-100 text-sky-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  purple: 'bg-purple-100 text-purple-700',
  red:    'bg-red-100 text-red-600',
  green:  'bg-emerald-100 text-emerald-700',
};

function StatusBadge({ status }: { status: number }) {
  const label = SHIPMENT_STATUS_LABELS[status] ?? `${status}`;
  const color = SHIPMENT_STATUS_COLOR[status] ?? 'gray';
  const style = STATUS_STYLES[color] ?? STATUS_STYLES.gray;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${style}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Order type icon
// ---------------------------------------------------------------------------

function OrderTypeIcon({ type }: { type: ShipmentOrder['order_type'] }) {
  const icons: Record<string, React.ReactNode> = {
    SEA_FCL: <Ship className="w-3.5 h-3.5" />,
    SEA_LCL: <Ship className="w-3.5 h-3.5" />,
    AIR:     <Plane className="w-3.5 h-3.5" />,
    GROUND:  <Truck className="w-3.5 h-3.5" />,
    CROSS_BORDER: <ArrowRight className="w-3.5 h-3.5" />,
  };
  return (
    <div className="flex items-center gap-1.5 text-[var(--text-mid)]">
      {icons[type] ?? null}
      <span className="text-xs">{ORDER_TYPE_LABELS[type] ?? type}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function ShipmentOrderTable({ orders, loading }: ShipmentOrderTableProps) {
  const router = useRouter();

  if (loading) return <ShipmentTableSkeleton />;

  if (!orders.length) {
    return (
      <div className="text-center py-16 text-[var(--text-muted)] text-sm">
        No shipment orders found
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <Th>Order ID</Th>
              <Th>Status</Th>
              <Th>Type</Th>
              <Th>Route</Th>
              <Th>Company</Th>
              <Th>Incoterm</Th>
              <Th>Cargo Ready</Th>
              <Th>Updated</Th>
              <Th><span className="sr-only">Actions</span></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {orders.map((order) => (
              <ShipmentRow
                key={order.quotation_id}
                order={order}
                onRowClick={() => router.push(`/shipments/${order.quotation_id}`)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
        {orders.length} orders shown
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-medium text-[var(--text-mid)] text-xs uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  );
}

function ShipmentRow({
  order,
  onRowClick,
}: {
  order: ShipmentOrder;
  onRowClick: () => void;
}) {
  return (
    <tr
      className="hover:bg-[var(--surface)] transition-colors cursor-pointer"
      onClick={onRowClick}
    >
      {/* Order ID */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-[var(--sky)]">
            {order.quotation_id}
          </span>
          {order.data_version === 1 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">
              V1
            </span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={order.status} />
      </td>

      {/* Order type */}
      <td className="px-4 py-3">
        <OrderTypeIcon type={order.order_type} />
      </td>

      {/* Route */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-mid)]">
          <span className="font-mono">{order.origin?.label ?? order.origin?.port_un_code ?? '—'}</span>
          <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="font-mono">{order.destination?.label ?? order.destination?.port_un_code ?? '—'}</span>
        </div>
      </td>

      {/* Company */}
      <td className="px-4 py-3">
        <div className="text-sm text-[var(--text)]">
          {order._company_name ?? order.company_id}
        </div>
        {order._company_name && (
          <div className="text-xs font-mono text-[var(--text-muted)]">
            {order.company_id}
          </div>
        )}
      </td>

      {/* Incoterm */}
      <td className="px-4 py-3">
        {order.incoterm_code
          ? <span className="px-2 py-0.5 bg-[var(--surface)] rounded text-xs font-mono text-[var(--text-mid)]">
              {order.incoterm_code}
            </span>
          : <span className="text-[var(--text-muted)]">—</span>}
      </td>

      {/* Cargo ready date */}
      <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
        {formatDate(order.cargo_ready_date)}
      </td>

      {/* Updated */}
      <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
        {formatDate(order.updated)}
      </td>

      {/* Actions (stop propagation so row click doesn't also fire) */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <button className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]">
          <MoreVertical className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function ShipmentTableSkeleton() {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              {['Order ID', 'Status', 'Type', 'Route', 'Company', 'Incoterm', 'Cargo Ready', 'Updated', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-mid)] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className={`h-4 bg-gray-100 rounded animate-pulse ${j === 0 ? 'w-28' : j === 3 ? 'w-32' : 'w-20'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
