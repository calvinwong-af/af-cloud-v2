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
import { getShipmentListAction, fetchShipmentOrderStatsAction, fetchCompaniesForShipmentAction, fetchPortsAction } from '@/app/actions/shipments';
import type { ShipmentListItem } from '@/app/actions/shipments';
import { getCurrentUserProfileAction } from '@/app/actions/users';
import type { ShipmentOrder, OrderType } from '@/lib/types';
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

// Map V1 short type codes from af-server to V2 OrderType for the table icons
const ORDER_TYPE_MAP: Record<string, OrderType> = {
  FCL: 'SEA_FCL',
  LCL: 'SEA_LCL',
  AIR: 'AIR',
  SEA_FCL: 'SEA_FCL',
  SEA_LCL: 'SEA_LCL',
  CROSS_BORDER: 'CROSS_BORDER',
  GROUND: 'GROUND',
};

/** Map a ShipmentListItem from af-server into the ShipmentOrder shape the table expects. */
function toShipmentOrder(item: ShipmentListItem): ShipmentOrder {
  return {
    quotation_id: item.shipment_id,
    countid: 0,
    data_version: item.data_version,
    company_id: item.company_id,
    order_type: ORDER_TYPE_MAP[item.order_type] ?? 'SEA_FCL',
    transaction_type: (item.transaction_type as ShipmentOrder['transaction_type']) || 'IMPORT',
    incoterm_code: item.incoterm || null,
    status: item.status as ShipmentOrder['status'],
    issued_invoice: false,
    last_status_updated: null,
    status_history: [],
    parent_id: null,
    related_orders: [],
    commercial_quotation_ids: [],
    origin: item.origin_port
      ? { type: 'PORT', port_un_code: item.origin_port, city_id: null, address: null, country_code: null, label: item.origin_port }
      : null,
    destination: item.destination_port
      ? { type: 'PORT', port_un_code: item.destination_port, city_id: null, address: null, country_code: null, label: item.destination_port }
      : null,
    cargo: null,
    type_details: null,
    booking: null,
    parties: null,
    customs_clearance: [],
    tracking_id: null,
    files: [],
    trash: false,
    cargo_ready_date: item.cargo_ready_date,
    creator: null,
    user: '',
    created: '',
    updated: item.updated,
    _company_name: item.company_name || undefined,
  };
}

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
      const [listResult, statsResult] = await Promise.all([
        getShipmentListAction(tab, cursor, 25),
        // Stats already loaded on mount — only refresh when explicitly requested (stats==null)
        stats == null ? fetchShipmentOrderStatsAction() : Promise.resolve({ success: true as const, data: stats }),
      ]);

      const fetchedOrders = listResult.shipments.map(toShipmentOrder);

      if (cursor) {
        setOrders((prev) => [...prev, ...fetchedOrders]);
      } else {
        setOrders(fetchedOrders);
      }
      setNextCursor(listResult.next_cursor);

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
