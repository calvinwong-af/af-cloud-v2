/**
 * ShipmentOrderTable — displays the list of shipment orders
 *
 * Works with both V1 (assembled) and V2 records via the unified ShipmentOrder shape.
 * Status and order type indicators are derived from V2 status codes.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MoreVertical, Ship, Plane, Truck, ArrowRight, Container, Package,
  FileText, FilePen, CircleCheck, BookmarkCheck, Bookmark, Anchor,
  AlertTriangle, PackageCheck, Ban, ReceiptText, Receipt, Stamp,
  ExternalLink, Copy, Hash, CopyPlus, Trash2, Loader2,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { deleteShipmentOrderAction } from '@/app/actions/shipments-write';
import type { ShipmentOrder } from '@/lib/types';
import { SHIPMENT_STATUS_LABELS, ORDER_TYPE_LABELS } from '@/lib/types';

interface ShipmentOrderTableProps {
  orders: ShipmentOrder[];
  loading: boolean;
  accountType: string | null;
  onRefresh: () => void;
}

// ---------------------------------------------------------------------------
// Status icon
// ---------------------------------------------------------------------------

function StatusIcon({ order }: { order: ShipmentOrder }) {
  const label = SHIPMENT_STATUS_LABELS[order.status] ?? `${order.status}`;

  const iconMap: Record<number, { icon: React.ReactNode; color: string }> = {
    1001: { icon: <FileText className="w-4 h-4" />,      color: 'var(--text-muted)' },
    1002: { icon: <FilePen className="w-4 h-4" />,       color: '#ca8a04' },
    2001: { icon: <CircleCheck className="w-4 h-4" />,   color: '#2563eb' },
    2002: { icon: <BookmarkCheck className="w-4 h-4" />, color: '#ea580c' },
    3001: { icon: <Bookmark className="w-4 h-4" />,      color: '#0d9488' },
    3002: { icon: order.order_type === 'AIR'
              ? <Plane className="w-4 h-4" />
              : <Ship className="w-4 h-4" />,            color: '#0284c7' },
    3003: { icon: <Anchor className="w-4 h-4" />,        color: '#4f46e5' },
    4001: { icon: <Stamp className="w-4 h-4" />,         color: '#7c3aed' },
    4002: { icon: <AlertTriangle className="w-4 h-4" />, color: '#dc2626' },
    5001: { icon: <PackageCheck className="w-4 h-4" />,  color: '#16a34a' },
    [-1]: { icon: <Ban className="w-4 h-4" />,           color: '#6b7280' },
  };

  const entry = iconMap[order.status] ?? iconMap[1001];

  return (
    <div className="flex items-center gap-2">
      <span title={label} style={{ color: entry.color }}>{entry.icon}</span>
      {order.status === 5001 && (
        order.issued_invoice
          ? <span title="Invoiced" style={{ color: '#16a34a' }}><ReceiptText className="w-4 h-4" /></span>
          : <span title="Awaiting Invoice" style={{ color: '#ca8a04' }}><Receipt className="w-4 h-4" /></span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order type icon
// ---------------------------------------------------------------------------

function OrderTypeIcon({ type }: { type: ShipmentOrder['order_type'] }) {
  const map: Record<string, { icon: React.ReactNode; label: string }> = {
    SEA_FCL:      { icon: <Container className="w-4 h-4" />, label: ORDER_TYPE_LABELS.SEA_FCL },
    SEA_LCL:      { icon: <Package className="w-4 h-4" />,   label: ORDER_TYPE_LABELS.SEA_LCL },
    AIR:          { icon: <Plane className="w-4 h-4" />,      label: ORDER_TYPE_LABELS.AIR },
    CROSS_BORDER: { icon: <Truck className="w-4 h-4" />,      label: ORDER_TYPE_LABELS.CROSS_BORDER },
    GROUND:       { icon: <Truck className="w-4 h-4" />,      label: ORDER_TYPE_LABELS.GROUND },
  };
  const entry = map[type] ?? { icon: null, label: type };
  return (
    <span title={entry.label} className="text-[var(--text-muted)] flex items-center justify-center">
      {entry.icon}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Actions menu
// ---------------------------------------------------------------------------

function ShipmentActionsMenu({
  order,
  accountType,
  onDeleted,
}: {
  order: ShipmentOrder;
  accountType: string | null;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'id' | 'tracking' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleCopy(text: string, type: 'id' | 'tracking') {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setOpen(false);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteShipmentOrderAction(order.quotation_id);
    setDeleting(false);
    if (result.success) {
      setShowConfirm(false);
      onDeleted();
    } else {
      setDeleteError(result.error);
    }
  }

  const showDelete = accountType?.startsWith('AFU') === true;

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={() => {
            if (!open && buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
            }
            setOpen((v) => !v);
          }}
          className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {open && menuPos && (
          <div
            className="fixed z-50 w-48 bg-white rounded-xl border border-[var(--border)] shadow-lg py-1 text-sm"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {/* View Details */}
            <button
              onClick={() => { setOpen(false); router.push(`/shipments/${order.quotation_id}`); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Details
            </button>

            {/* Copy Order ID */}
            <button
              onClick={() => handleCopy(order.quotation_id, 'id')}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
            >
              <Copy className="w-4 h-4" />
              {copied === 'id' ? 'Copied!' : 'Copy Order ID'}
            </button>

            {/* Copy Tracking ID */}
            {order.tracking_id && (
              <button
                onClick={() => handleCopy(order.tracking_id!, 'tracking')}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
              >
                <Hash className="w-4 h-4" />
                {copied === 'tracking' ? 'Copied!' : 'Copy Tracking ID'}
              </button>
            )}

            {/* Duplicate Shipment (disabled) */}
            <button
              disabled
              title="Coming soon"
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[var(--text)] opacity-40 cursor-not-allowed"
            >
              <CopyPlus className="w-4 h-4" />
              Duplicate Shipment
            </button>

            {/* Divider + Delete */}
            {showDelete && (
              <>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  onClick={() => { setShowConfirm(true); setOpen(false); setDeleteError(null); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>

            <h3 className="text-base font-semibold text-[var(--text)] mb-1">Delete Shipment?</h3>
            <p className="text-sm text-[var(--text-muted)] mb-1">
              This will permanently delete <span className="font-medium text-[var(--text)]">{order.quotation_id}</span>.
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-1">
              {order.quotation_id.startsWith('AF2-')
                ? 'All associated records will also be removed.'
                : 'Only the order record will be removed. Legacy records are preserved.'}
            </p>
            <p className="text-sm text-red-600 font-medium mb-5">
              This action cannot be undone.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function ShipmentOrderTable({ orders, loading, accountType, onRefresh }: ShipmentOrderTableProps) {
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
                accountType={accountType}
                onRowClick={() => router.push(`/shipments/${order.quotation_id}`)}
                onDeleted={onRefresh}
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
  accountType,
  onRowClick,
  onDeleted,
}: {
  order: ShipmentOrder;
  accountType: string | null;
  onRowClick: () => void;
  onDeleted: () => void;
}) {
  const originCode = order.origin?.port_un_code ?? order.origin?.label ?? '—';
  const destCode = order.destination?.port_un_code ?? order.destination?.label ?? '—';

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

      {/* Status + Invoice icon */}
      <td className="px-4 py-3">
        <StatusIcon order={order} />
      </td>

      {/* Order type — icon only */}
      <td className="px-4 py-3 text-center">
        <OrderTypeIcon type={order.order_type} />
      </td>

      {/* Route — port codes only */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-[var(--text-mid)]">
          <span className="font-mono">{originCode}</span>
          <ArrowRight className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />
          <span className="font-mono">{destCode}</span>
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

      {/* Actions */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <ShipmentActionsMenu order={order} accountType={accountType} onDeleted={onDeleted} />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
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
