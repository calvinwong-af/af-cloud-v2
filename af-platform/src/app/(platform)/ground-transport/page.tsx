'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Container, Truck, CheckCircle2, RefreshCw, Plus } from 'lucide-react';
import {
  listGroundTransportOrdersAction,
  fetchVehicleTypesAction,
} from '@/app/actions/ground-transport';
import type { GroundTransportOrder, VehicleType } from '@/app/actions/ground-transport';
import { fetchCitiesAction, fetchAreasAction } from '@/app/actions/geography';
import { getCurrentUserProfileAction } from '@/app/actions/users';
import { KpiCard } from '@/components/shared/KpiCard';
import CreateGroundTransportModal from '@/components/ground-transport/CreateGroundTransportModal';
import type { City, Area } from '@/lib/types';

// ---------------------------------------------------------------------------
// Status badge styles
// ---------------------------------------------------------------------------

const GT_STATUS_STYLES: Record<string, string> = {
  draft:       'bg-gray-100 text-gray-700',
  confirmed:   'bg-blue-100 text-blue-800',
  dispatched:  'bg-sky-100 text-sky-800',
  in_transit:  'bg-amber-100 text-amber-800',
  detained:    'bg-orange-100 text-orange-800',
  completed:   'bg-emerald-100 text-emerald-800',
  cancelled:   'bg-red-100 text-red-700',
};

const LEG_TYPE_LABELS: Record<string, string> = {
  first_mile:   'First Mile',
  last_mile:    'Last Mile',
  standalone:   'Standalone',
  distribution: 'Distribution',
};

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

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'haulage' | 'trucking' | 'active' | 'completed' | 'cancelled';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'haulage',    label: 'Haulage' },
  { key: 'trucking',   label: 'Trucking' },
  { key: 'active',     label: 'Active' },
  { key: 'completed',  label: 'Completed' },
  { key: 'cancelled',  label: 'Cancelled' },
];

function buildFilters(tab: FilterTab): { transport_mode?: string; status?: string } {
  if (tab === 'haulage') return { transport_mode: 'haulage' };
  if (tab === 'trucking') return { transport_mode: 'trucking' };
  if (tab === 'active') return { status: 'active' };
  if (tab === 'completed') return { status: 'completed' };
  if (tab === 'cancelled') return { status: 'cancelled' };
  return {};
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function GroundTransportPageInner() {
  const router = useRouter();
  const [orders, setOrders] = useState<GroundTransportOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);

  const fetchIdRef = useRef(0);

  // Load profile + reference data on mount
  useEffect(() => {
    Promise.all([
      getCurrentUserProfileAction(),
      fetchCitiesAction(),
      fetchAreasAction(),
      fetchVehicleTypesAction(),
    ]).then(([profile, citiesRes, areasRes, vtRes]) => {
      if (profile.account_type !== 'AFU') {
        router.replace('/dashboard');
        return;
      }
      if (citiesRes.success) setCities(citiesRes.data);
      if (areasRes.success) setAreas(areasRes.data);
      if (vtRes.success) setVehicleTypes(vtRes.data);
      setProfileLoaded(true);
    });
  }, [router]);

  const load = useCallback(async (tab: FilterTab) => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await listGroundTransportOrdersAction(buildFilters(tab));
      if (fetchId !== fetchIdRef.current) return;
      if (!result) {
        setError('No response from server');
      } else if (result.success) {
        setOrders(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      if (fetchId !== fetchIdRef.current) return;
      setError('Failed to load orders');
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profileLoaded) load(activeTab);
  }, [activeTab, profileLoaded, load]);

  function handleTabChange(tab: FilterTab) {
    setActiveTab(tab);
    setOrders([]);
  }

  // Compute stats from loaded orders (for 'all' tab)
  const allOrders = orders;
  const activeStatuses = new Set(['dispatched', 'in_transit', 'detained']);
  const stats = {
    total: allOrders.length,
    active: allOrders.filter((o) => activeStatuses.has(o.status)).length,
    haulage: allOrders.filter((o) => o.transport_mode === 'haulage').length,
    trucking: allOrders.filter((o) => o.transport_mode === 'trucking').length,
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text)]">Ground Transport</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Haulage and trucking orders
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[var(--sky)] text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New Ground Transport
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Package className="w-5 h-5" />} label="Total Orders" value={stats.total} loading={loading} />
        <KpiCard icon={<CheckCircle2 className="w-5 h-5" />} label="Active" value={stats.active} loading={loading} color="sky" />
        <KpiCard icon={<Container className="w-5 h-5" />} label="Haulage" value={stats.haulage} loading={loading} color="amber" />
        <KpiCard icon={<Truck className="w-5 h-5" />} label="Trucking" value={stats.trucking} loading={loading} color="purple" />
      </div>

      {/* Filter tabs */}
      <div className="border-b border-[var(--border)]">
        <nav className="flex gap-1 overflow-x-auto pb-px -mb-px" style={{ scrollbarWidth: 'none' }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-[var(--sky)] text-[var(--sky)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {tab.label}
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

      {/* Loading skeleton */}
      {(loading || !profileLoaded) && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && profileLoaded && orders.length === 0 && !error && (
        <div className="text-center py-12 text-sm text-[var(--text-muted)]">
          No ground transport orders found
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Order ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Leg Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Parent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Route</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Vendor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const stops = order.stops ?? [];
                  const sortedStops = [...stops].sort((a, b) => a.sequence - b.sequence);
                  const firstStop = sortedStops[0];
                  const lastStop = sortedStops[sortedStops.length - 1];
                  const originLabel = firstStop?.address_line ?? '—';
                  const destLabel = (lastStop ?? firstStop)?.address_line ?? '—';

                  return (
                    <tr
                      key={order.order_id}
                      onClick={() => window.open(`/ground-transport/${order.order_id}`, '_blank')}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-[var(--sky)] font-medium">
                        {order.order_id}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          order.transport_mode === 'haulage'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.transport_mode.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-mid)]">
                        {LEG_TYPE_LABELS[order.leg_type] ?? order.leg_type}
                      </td>
                      <td className="px-4 py-3">
                        {order.parent_order_id ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/shipments/${order.parent_order_id}`, '_blank');
                            }}
                            className="font-mono text-xs text-[var(--sky)] hover:underline"
                          >
                            {order.parent_order_id}
                          </button>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-mid)] max-w-[200px] truncate">
                        {firstStop
                          ? `${originLabel} → ${destLabel}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${GT_STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-mid)]">
                        {order.vendor_id ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                        {timeAgo(order.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateGroundTransportModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => load(activeTab)}
          cities={cities}
          areas={areas}
          vehicleTypes={vehicleTypes}
        />
      )}
    </div>
  );
}

export default function GroundTransportPage() {
  return <Suspense><GroundTransportPageInner /></Suspense>;
}
