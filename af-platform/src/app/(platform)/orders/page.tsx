'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  Package, Container, Truck, Ship, Plane,
  RefreshCw, ArrowRight, Link as LinkIcon,
  MoreVertical, ExternalLink, Copy, CheckCircle2,
  FileText, CircleCheck, Bookmark, Stamp,
  Anchor, PackageCheck, Ban,
  Trash2, AlertTriangle, Loader2, Zap,
} from 'lucide-react';
import { listOrdersAction, fetchOrderStatsAction } from '@/app/actions/orders';
import type { OrderListItem, OrderStats } from '@/app/actions/orders';
import { getCurrentUserProfileAction } from '@/app/actions/users';
import { KpiCard } from '@/components/shared/KpiCard';

// ---------------------------------------------------------------------------
// Status styles + labels
// ---------------------------------------------------------------------------



const STATUS_DISPLAY: Record<string, string> = {
  draft:             'Draft',
  confirmed:         'Confirmed',
  in_progress:       'In Progress',
  booking_pending:   'Booking Pending',
  booking_confirmed: 'Booking Confirmed',
  in_transit:        'In Transit',
  arrived:           'Arrived',
  dispatched:        'Dispatched',
  detained:          'Detained',
  completed:         'Completed',
  cancelled:         'Cancelled',
};

// ---------------------------------------------------------------------------
// Status icon — mirrors ShipmentOrderTable StatusIcon for shipments,
// uses a simpler colour-dot approach for transport statuses
// ---------------------------------------------------------------------------

function StatusIcon({ status, subStatus, orderType }: {
  status: string;
  subStatus: string | null;
  orderType: string;
}) {
  const key = subStatus || status;

  // Shipment sub-status icons
  const shipmentIconMap: Record<string, { icon: React.ReactNode; color: string }> = {
    draft:             { icon: <FileText   className="w-4 h-4" />, color: 'var(--text-muted)' },
    confirmed:         { icon: <CircleCheck className="w-4 h-4" />, color: '#2563eb' },
    booking_pending:   { icon: <Bookmark   className="w-4 h-4" />, color: '#0d9488' },
    booking_confirmed: { icon: <Stamp      className="w-4 h-4" />, color: '#0284c7' },
    in_transit:        { icon: <Ship       className="w-4 h-4" />, color: '#0369a1' },
    arrived:           { icon: <Anchor     className="w-4 h-4" />, color: '#7c3aed' },
    completed:         { icon: <PackageCheck className="w-4 h-4" />, color: '#16a34a' },
    cancelled:         { icon: <Ban        className="w-4 h-4" />, color: '#6b7280' },
    in_progress:       { icon: <Ship       className="w-4 h-4" />, color: '#0369a1' },
  };

  // Transport status icons
  const transportIconMap: Record<string, { icon: React.ReactNode; color: string }> = {
    draft:       { icon: <FileText    className="w-4 h-4" />, color: 'var(--text-muted)' },
    confirmed:   { icon: <CircleCheck className="w-4 h-4" />, color: '#2563eb' },
    dispatched:  { icon: <Truck       className="w-4 h-4" />, color: '#0284c7' },
    in_transit:  { icon: <Truck       className="w-4 h-4" />, color: '#d97706' },
    detained:    { icon: <AlertTriangle className="w-4 h-4" />, color: '#ea580c' },
    completed:   { icon: <PackageCheck className="w-4 h-4" />, color: '#16a34a' },
    cancelled:   { icon: <Ban         className="w-4 h-4" />, color: '#6b7280' },
  };

  const map = orderType === 'transport' ? transportIconMap : shipmentIconMap;
  const entry = map[key] ?? map[status] ?? { icon: <FileText className="w-4 h-4" />, color: 'var(--text-muted)' };
  const label = STATUS_DISPLAY[key] ?? key.replace(/_/g, ' ');

  return (
    <span title={label} style={{ color: entry.color }} className="flex items-center justify-center">
      {entry.icon}
    </span>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

function formatBadge(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Type icon
// ---------------------------------------------------------------------------

function OrderTypeIcon({ order }: { order: OrderListItem }) {
  const cls = 'w-4 h-4';
  if (order.order_type === 'shipment') {
    if (order.order_type_detail === 'AIR')     return <Plane     className={cls} />;
    if (order.order_type_detail === 'SEA_FCL') return <Container className={cls} />;
    if (order.order_type_detail === 'SEA_LCL') return <Package   className={cls} />;
    return <Ship className={cls} />;
  }
  if (order.transport_mode === 'trucking') return <Truck     className={cls} />;
  if (order.transport_mode === 'haulage')  return <Container className={cls} />;
  return <Package className={cls} />;
}

// ---------------------------------------------------------------------------
// Actions menu (portal — escapes overflow clipping)
// ---------------------------------------------------------------------------

function OrderActionsMenu({ order, accountType }: { order: OrderListItem; accountType: string | null }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showHardConfirm, setShowHardConfirm] = useState(false);
  const [hardDeleting, setHardDeleting] = useState(false);
  const [hardDeleteError, setHardDeleteError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAfu = accountType === 'AFU';
  const detailHref = order.order_type === 'transport'
    ? `/ground-transport/${order.order_id}`
    : `/shipments/${order.order_id}`;

  // Outside-click close
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(t) &&
        dropdownRef.current && !dropdownRef.current.contains(t)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuHeight = 100;
      const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4;
      setMenuPos({ top, right: window.innerWidth - rect.right });
    }
    setOpen(v => !v);
  }

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(order.order_id);
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    setDeleteError(null);
    try {
      let result: { success: boolean; error?: string };
      if (order.order_type === 'transport') {
        const { deleteGroundTransportOrderAction } = await import('@/app/actions/ground-transport');
        result = await deleteGroundTransportOrderAction(order.order_id, false);
      } else {
        const { deleteShipmentOrderAction } = await import('@/app/actions/shipments-write');
        result = await deleteShipmentOrderAction(order.order_id, false);
      }
      if (!result.success) throw new Error(result.error ?? 'Delete failed');
      setShowDeleteConfirm(false);
      window.location.reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  async function handleHardDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setHardDeleting(true);
    setHardDeleteError(null);
    try {
      let result: { success: boolean; error?: string };
      if (order.order_type === 'transport') {
        const { deleteGroundTransportOrderAction } = await import('@/app/actions/ground-transport');
        result = await deleteGroundTransportOrderAction(order.order_id, true);
      } else {
        const { deleteShipmentOrderAction } = await import('@/app/actions/shipments-write');
        result = await deleteShipmentOrderAction(order.order_id, true);
      }
      if (!result.success) throw new Error(result.error ?? 'Hard delete failed');
      setShowHardConfirm(false);
      window.location.reload();
    } catch (err) {
      setHardDeleteError(err instanceof Error ? err.message : 'Hard delete failed');
      setHardDeleting(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && menuPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[200] w-48 bg-white rounded-xl border border-[var(--border)] shadow-lg py-1 text-sm"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); window.open(detailHref, '_blank'); }}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Details
          </button>
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Order ID'}
          </button>
          {isAfu && (
            <>
              <div className="my-1 border-t border-[var(--border)]" />
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); setDeleteError(null); setShowDeleteConfirm(true); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); setHardDeleteError(null); setShowHardConfirm(true); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-red-700 hover:bg-red-700 hover:text-white transition-colors font-medium"
              >
                <Zap className="w-4 h-4" />
                Hard Delete
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Soft delete confirmation modal */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-[var(--text)] mb-1">Delete Order?</h3>
            <p className="text-sm text-[var(--text-muted)] mb-1">
              This will permanently delete <span className="font-mono font-medium text-[var(--text)]">{order.order_id}</span>.
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-1">All associated records will also be removed.</p>
            <p className="text-sm text-red-600 font-medium mb-5">This action cannot be undone.</p>
            {deleteError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{deleteError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
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
        </div>,
        document.body
      )}

      {/* Hard delete confirmation modal */}
      {showHardConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHardConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-900 px-6 py-5">
              <div className="w-10 h-10 rounded-full bg-red-700 flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-white">Hard Delete</h3>
              <p className="text-sm text-red-200 mt-0.5">Permanent — cannot be recovered</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[var(--text)] mb-2">
                This will permanently erase <span className="font-mono font-semibold">{order.order_id}</span> and all associated records from the database.
              </p>
              <p className="text-sm text-[var(--text-muted)] mb-1">The following will be deleted:</p>
              <ul className="text-sm text-[var(--text-muted)] mb-4 ml-4 list-disc space-y-0.5">
                <li>Order record</li>
                <li>Workflow &amp; tasks</li>
                <li>All uploaded files</li>
              </ul>
              <p className="text-xs text-red-700 font-semibold mb-5 uppercase tracking-wide">
                ⚠ This cannot be undone. No recovery is possible.
              </p>
              {hardDeleteError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{hardDeleteError}</div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowHardConfirm(false); setHardDeleteError(null); }}
                  className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleHardDelete}
                  disabled={hardDeleting}
                  className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-900 text-white font-semibold hover:bg-red-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {hardDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {hardDeleting ? 'Deleting…' : 'Hard Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'active' | 'closed' | 'cancelled';

const FILTER_TABS: { key: FilterTab; label: string; showBadge: boolean }[] = [
  { key: 'all',       label: 'All',       showBadge: true  },
  { key: 'active',    label: 'Active',    showBadge: true  },
  { key: 'closed',    label: 'Closed',    showBadge: false },
  { key: 'cancelled', label: 'Cancelled', showBadge: true  },
];

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="hidden md:block bg-white border border-[var(--border)] rounded-xl overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
            {['Order ID', 'Status', 'Type', 'Route', 'Company', 'Created', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-mid)] uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: 7 }).map((_, j) => (
                <td key={j} className="px-4 py-3">
                  <div className={`h-4 bg-gray-100 rounded animate-pulse ${j === 0 ? 'w-28' : j === 3 ? 'w-24' : 'w-20'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function OrdersPageInner() {
  const [orders, setOrders]               = useState<OrderListItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState<FilterTab>('active');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [stats, setStats]                 = useState<OrderStats | null>(null);
  const [nextCursor, setNextCursor]       = useState<string | null>(null);
  const [loadingMore, setLoadingMore]     = useState(false);

  const fetchIdRef = useRef(0);

  useEffect(() => {
    getCurrentUserProfileAction().then((profile) => {
      setAccountType(profile.account_type);
      setProfileLoaded(true);
    });
  }, []);

  const load = useCallback(async (tab: FilterTab, offset?: number) => {
    const fetchId = ++fetchIdRef.current;
    if (!offset) { setLoading(true); setOrders([]); }
    else setLoadingMore(true);
    setError(null);

    try {
      const [listResult, statsResult] = await Promise.all([
        listOrdersAction(tab, offset ?? 0, 25),
        !offset ? fetchOrderStatsAction() : Promise.resolve(null),
      ]);
      if (fetchId !== fetchIdRef.current) return;

      if (offset) setOrders(prev => [...prev, ...listResult.items]);
      else setOrders(listResult.items);
      setNextCursor(listResult.next_cursor);

      if (statsResult && 'success' in statsResult && statsResult.success) {
        setStats(statsResult.data);
      }
    } catch {
      if (fetchId !== fetchIdRef.current) return;
      setError('Failed to load orders');
    } finally {
      if (fetchId === fetchIdRef.current) { setLoading(false); setLoadingMore(false); }
    }
  }, []);

  useEffect(() => {
    if (profileLoaded) load(activeTab);
  }, [activeTab, profileLoaded, load]);

  function handleTabChange(tab: FilterTab) {
    setActiveTab(tab);
    setOrders([]);
    setNextCursor(null);
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text)]">Orders</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">All operational orders</p>
        </div>
        <button
          onClick={() => load(activeTab)}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Package className="w-5 h-5" />}       label="Total Orders" value={stats?.total  ?? '—'} loading={stats == null} />
        <KpiCard icon={<CheckCircle2 className="w-5 h-5" />}  label="Active"       value={stats?.active ?? '—'} loading={stats == null} color="sky" />
        <KpiCard icon={<Package className="w-5 h-5" />}       label="—"            value={0}                   loading={false} />
        <KpiCard icon={<Package className="w-5 h-5" />}       label="—"            value={0}                   loading={false} />
      </div>

      {/* Filter tabs */}
      <div className="border-b border-[var(--border)]">
        <nav className="flex gap-1 overflow-x-auto pb-px -mb-px" style={{ scrollbarWidth: 'none' }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.key
                  ? 'border-[var(--sky)] text-[var(--sky)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
            >
              {tab.label}
              {tab.showBadge && stats && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full
                  ${activeTab === tab.key ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>
                  {formatBadge(
                    tab.key === 'all'       ? stats.total     :
                    tab.key === 'active'    ? stats.active    :
                    stats.cancelled
                  )}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <span className="font-medium">Error:</span> {error}
          <button onClick={() => load(activeTab)} className="ml-auto underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {(loading || !profileLoaded) && <TableSkeleton />}

      {/* Empty */}
      {!loading && profileLoaded && orders.length === 0 && !error && (
        <div className="text-center py-16 text-sm text-[var(--text-muted)]">No orders found</div>
      )}

      {/* Table */}
      {!loading && orders.length > 0 && (
        <div className="hidden md:block bg-white border border-[var(--border)] rounded-xl overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--text-mid)] text-xs uppercase tracking-wide whitespace-nowrap">Order ID</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-mid)] text-xs uppercase tracking-wide whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-mid)] text-xs uppercase tracking-wide whitespace-nowrap text-center">Type</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-mid)] text-xs uppercase tracking-wide whitespace-nowrap">Route</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-mid)] text-xs uppercase tracking-wide whitespace-nowrap">Company</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-mid)] text-xs uppercase tracking-wide whitespace-nowrap">Created</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-mid)] text-xs uppercase tracking-wide whitespace-nowrap sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {orders.map((order) => {
                const detailHref = order.order_type === 'transport'
                  ? `/ground-transport/${order.order_id}`
                  : `/shipments/${order.order_id}`;

                return (
                  <tr
                    key={order.order_id}
                    onClick={() => window.open(detailHref, '_blank', 'noopener,noreferrer')}
                    className="hover:bg-[var(--surface)] transition-colors cursor-pointer"
                  >
                    {/* Order ID */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-[var(--sky)]">
                          {order.order_id}
                        </span>
                        {order.parent_order_id && (
                          <span title={`Child of ${order.parent_order_id}`}>
                            <LinkIcon className="w-3 h-3 text-[var(--text-muted)]" />
                          </span>
                        )}
                        {order.is_test && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 leading-none">TEST</span>
                        )}
                      </div>
                    </td>

                    {/* Status icon */}
                    <td className="px-4 py-3">
                      <StatusIcon status={order.status} subStatus={order.sub_status} orderType={order.order_type} />
                    </td>

                    {/* Type icon */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-[var(--text-muted)] flex items-center justify-center">
                        <OrderTypeIcon order={order} />
                      </span>
                    </td>

                    {/* Route */}
                    <td className="px-4 py-3">
                      {order.order_type === 'shipment' && order.origin_port && order.dest_port ? (
                        <div className="flex items-center gap-1.5 text-sm text-[var(--text-mid)]">
                          <span className="font-mono">{order.origin_port}</span>
                          <ArrowRight className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />
                          <span className="font-mono">{order.dest_port}</span>
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-[var(--text)] leading-tight">
                        {order.company_name || '—'}
                      </div>
                      {order.company_name && (
                        <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                          {order.company_id}
                        </div>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {timeAgo(order.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <OrderActionsMenu order={order} accountType={accountType} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
            {orders.length} orders shown
          </div>
        </div>
      )}

      {/* Load more */}
      {nextCursor && !loading && (
        <div className="flex justify-center">
          <button
            onClick={() => load(activeTab, parseInt(nextCursor))}
            disabled={loadingMore}
            className="px-6 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return <Suspense><OrdersPageInner /></Suspense>;
}
