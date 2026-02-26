/**
 * /shipments — ShipmentOrders list
 *
 * Shows all shipment orders (parent orders only — no ground children).
 * Unified V1+V2 view via the assembly layer.
 * Supports status filter tabs, search, and pagination.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, Truck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchShipmentOrdersAction, fetchShipmentOrderStatsAction, fetchCompaniesForShipmentAction, fetchPortsAction } from '@/app/actions/shipments';
import { getCurrentUserProfileAction } from '@/app/actions/users';
import type { ShipmentOrder, ShipmentOrderStatus } from '@/lib/types';
import { ShipmentOrderTable } from '@/components/shipments/ShipmentOrderTable';
import { KpiCard } from '@/components/shared/KpiCard';
import NewShipmentButton from '@/components/shipments/NewShipmentButton';

// ---------------------------------------------------------------------------
// Status filter tabs
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'active' | 'draft' | 'completed' | 'to_invoice' | 'cancelled';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'active',     label: 'Active' },
  { key: 'draft',      label: 'Draft' },
  { key: 'completed',  label: 'Completed' },
  { key: 'to_invoice', label: 'To Invoice' },
  { key: 'cancelled',  label: 'Cancelled' },
];

const FILTER_STATUS_MAP: Record<FilterTab, ShipmentOrderStatus[] | undefined> = {
  all:        undefined,
  active:     [2001, 2002, 3001, 3002, 3003, 4001, 4002],
  draft:      [1001, 1002],
  completed:  [5001],
  to_invoice: [5001],   // further filtered by issued_invoice=false below
  cancelled:  [-1],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShipmentsPage() {
  const [orders, setOrders] = useState<ShipmentOrder[]>([]);
  const [stats, setStats] = useState<{
    total: number; active: number; draft: number; completed: number; to_invoice: number; cancelled: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('active');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [companies, setCompanies] = useState<{ company_id: string; name: string }[]>([]);
  const [ports, setPorts] = useState<{ un_code: string; name: string; country: string; port_type: string }[]>([]);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    // Load profile, companies, ports and stats in parallel on mount
    Promise.all([
      fetchCompaniesForShipmentAction(),
      fetchPortsAction(),
      getCurrentUserProfileAction(),
      fetchShipmentOrderStatsAction(),
    ]).then(([c, p, profile, statsResult]) => {
      setCompanies(c);
      setPorts(p);
      setAccountType(profile.account_type);
      setProfileLoaded(true);
      if (statsResult.success) setStats(statsResult.data);
    });
  }, []);

  const load = useCallback(async (tab: FilterTab, cursor?: string) => {
    if (!cursor) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const statusFilter = FILTER_STATUS_MAP[tab];
      const [ordersResult, statsResult] = await Promise.all([
        fetchShipmentOrdersAction({
          status: statusFilter,
          limit: 50,
          cursor,
        }),
        // Stats already loaded on mount — only refresh when explicitly requested (stats==null)
        stats == null ? fetchShipmentOrderStatsAction() : Promise.resolve({ success: true as const, data: stats }),
      ]);

      if (!ordersResult.success) throw new Error(ordersResult.error);

      // For the to_invoice tab, further filter to issued_invoice=false
      // issued_invoice may be stored as boolean false, 0, null, or undefined in V1 records
      const fetchedOrders = tab === 'to_invoice'
        ? ordersResult.data.orders.filter((o) => !o.issued_invoice)
        : ordersResult.data.orders;

      if (cursor) {
        setOrders((prev) => [...prev, ...fetchedOrders]);
      } else {
        setOrders(fetchedOrders);
      }
      setNextCursor(ordersResult.data.nextCursor);

      if (statsResult.success) setStats(statsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [stats]);

  useEffect(() => {
    load(activeTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function handleTabChange(tab: FilterTab) {
    setActiveTab(tab);
    setOrders([]);
    setNextCursor(null);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Shipment Orders</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            All active and historical shipments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(activeTab)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <NewShipmentButton companies={companies} ports={ports} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Package className="w-5 h-5" />}
          label="Total Orders"
          value={stats?.total ?? '—'}
          loading={stats == null}
        />
        <KpiCard
          icon={<Truck className="w-5 h-5" />}
          label="Active"
          value={stats?.active ?? '—'}
          loading={stats == null}
          color="sky"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Completed"
          value={stats?.completed ?? '—'}
          loading={stats == null}
          color="green"
        />
        <KpiCard
          icon={<AlertCircle className="w-5 h-5" />}
          label="Draft"
          value={stats?.draft ?? '—'}
          loading={stats == null}
          color="amber"
        />
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-[var(--border)]">
        <nav className="flex gap-1">
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
              {stats && tab.key !== 'all' && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full
                  ${activeTab === tab.key ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>
                  {tab.key === 'to_invoice' ? stats.to_invoice : stats[tab.key as keyof typeof stats] ?? 0}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <span className="font-medium">Error:</span> {error}
          <button onClick={() => load(activeTab)} className="ml-auto underline">Retry</button>
        </div>
      )}

      {/* Table */}
      <ShipmentOrderTable orders={orders} loading={loading || !profileLoaded} accountType={accountType} onRefresh={() => { setStats(null); load(activeTab); }} />

      {/* Load more */}
      {nextCursor && !loading && (
        <div className="flex justify-center">
          <button
            onClick={() => load(activeTab, nextCursor)}
            disabled={loadingMore}
            className="px-6 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)]
                       hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
