/**
 * /shipments — ShipmentOrders list
 *
 * Shows all shipment orders (parent orders only — no ground children).
 * Unified V1+V2 view via the assembly layer.
 * Supports status filter tabs, search, and pagination.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Truck, CheckCircle2, AlertCircle, RefreshCw, Search, X } from 'lucide-react';
import { getShipmentListAction, fetchShipmentOrderStatsAction, fetchCompaniesForShipmentAction, fetchPortsAction, searchShipmentsAction } from '@/app/actions/shipments';
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
      ? { type: 'PORT', port_un_code: item.origin_port, terminal_id: null, city_id: null, address: null, country_code: null, label: item.origin_port }
      : null,
    destination: item.destination_port
      ? { type: 'PORT', port_un_code: item.destination_port, terminal_id: null, city_id: null, address: null, country_code: null, label: item.destination_port }
      : null,
    cargo: null,
    type_details: null,
    booking: null,
    parties: null,
    customs_clearance: [],
    bl_document: null,
    exception: null,
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
  const [ports, setPorts] = useState<{ un_code: string; name: string; country: string; port_type: string; has_terminals: boolean; terminals: Array<{ terminal_id: string; name: string; is_default: boolean }> }[]>([]);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ShipmentOrder[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Ref to track fetch generation — incremented on each new load call.
  // Stale responses (where fetchId !== fetchIdRef.current) are ignored.
  const fetchIdRef = useRef(0);
  const statsRef = useRef(stats);
  statsRef.current = stats;

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
    const fetchId = ++fetchIdRef.current;
    console.log('[ShipmentsPage] fetching list for tab:', tab, 'fetchId:', fetchId);

    if (!cursor) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const currentStats = statsRef.current;
      const [listResult, statsResult] = await Promise.all([
        getShipmentListAction(tab, cursor, 25),
        // Stats already loaded on mount — only refresh when explicitly requested (stats==null)
        currentStats == null ? fetchShipmentOrderStatsAction() : Promise.resolve({ success: true as const, data: currentStats }),
      ]);

      // Ignore stale responses — a newer load() has been triggered
      if (fetchId !== fetchIdRef.current) {
        console.log('[ShipmentsPage] STALE response ignored — fetchId:', fetchId, 'current:', fetchIdRef.current);
        return;
      }

      console.log('[ShipmentsPage] list result:', listResult.shipments?.length, 'items for tab:', tab);

      const fetchedOrders = listResult.shipments.map(toShipmentOrder);

      if (cursor) {
        setOrders((prev) => [...prev, ...fetchedOrders]);
      } else {
        console.log('[ShipmentsPage] setOrders called with:', fetchedOrders.length, 'items');
        setOrders(fetchedOrders);
      }
      setNextCursor(listResult.next_cursor);

      if (statsResult.success) setStats(statsResult.data);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    load(activeTab);
  }, [activeTab, load]);

  function handleTabChange(tab: FilterTab) {
    console.log('[ShipmentsPage] tab changed to:', tab);
    console.log('[ShipmentsPage] list CLEARED at:', new Error().stack);
    setActiveTab(tab);
    setOrders([]);
    setNextCursor(null);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (value.trim().length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const results = await searchShipmentsAction(value.trim(), 'all', 25);
      setSearchResults(results.map((r) => toShipmentOrder({
        shipment_id: r.shipment_id,
        data_version: r.data_version,
        status: r.status,
        order_type: r.order_type,
        transaction_type: '',
        incoterm: '',
        origin_port: r.origin_port,
        destination_port: r.destination_port,
        company_id: r.company_id,
        company_name: r.company_name,
        cargo_ready_date: '',
        updated: r.updated,
      })));
      setSearching(false);
    }, 300);
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }

  const isSearchActive = searchQuery.trim().length >= 3;

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text)]">Shipment Orders</h1>
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

      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 border border-[var(--border)] bg-white">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search shipments by ID, company name, or port code…"
            className="flex-1 text-sm bg-transparent outline-none"
            style={{ color: 'var(--text)' }}
          />
          {searchQuery && (
            <button onClick={clearSearch} className="p-0.5 rounded hover:bg-[var(--surface)] transition-colors">
              <X size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Search active indicator or filter tabs */}
      {isSearchActive ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <span>Searching across all shipments</span>
          {!searching && <span className="font-medium" style={{ color: 'var(--text)' }}>· {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>}
          {searching && <span className="italic">…</span>}
        </div>
      ) : (
        <div className="border-b border-[var(--border)]">
          <nav className="flex gap-1 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
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
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <span className="font-medium">Error:</span> {error}
          <button onClick={() => load(activeTab)} className="ml-auto underline">Retry</button>
        </div>
      )}

      {/* Table */}
      <ShipmentOrderTable
        orders={isSearchActive ? searchResults : orders}
        loading={isSearchActive ? searching : (loading || !profileLoaded)}
        accountType={accountType}
        onRefresh={() => { setStats(null); statsRef.current = null; load(activeTab); }}
      />

      {/* Load more */}
      {!isSearchActive && nextCursor && !loading && (
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
