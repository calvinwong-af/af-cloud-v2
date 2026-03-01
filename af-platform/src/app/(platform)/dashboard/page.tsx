/**
 * /dashboard — Platform overview
 *
 * KPI cards (shipment + company stats) and a recent shipments table.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, Building2, PackageCheck, CheckCircle2, FileEdit, RefreshCw, ChevronRight } from 'lucide-react';
import { fetchShipmentOrderStatsAction, fetchDashboardShipmentsAction } from '@/app/actions/shipments';
import type { ShipmentListItem } from '@/app/actions/shipments';
import { fetchCompanyStatsAction } from '@/app/actions/companies';
import { getCurrentUserProfileAction } from '@/app/actions/users';
import { KpiCard } from '@/components/shared/KpiCard';
import { ShipmentOrderTable } from '@/components/shipments/ShipmentOrderTable';
import type { ShipmentOrder, OrderType } from '@/lib/types';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORDER_TYPE_MAP: Record<string, OrderType> = {
  FCL: 'SEA_FCL',
  LCL: 'SEA_LCL',
  AIR: 'AIR',
  SEA_FCL: 'SEA_FCL',
  SEA_LCL: 'SEA_LCL',
  CROSS_BORDER: 'CROSS_BORDER',
  GROUND: 'GROUND',
};

function toShipmentOrder(item: ShipmentListItem): ShipmentOrder {
  return {
    quotation_id: item.shipment_id,
    countid: 0,
    data_version: item.data_version,
    migrated_from_v1: item.migrated_from_v1,
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
// Types
// ---------------------------------------------------------------------------

interface ShipmentStats {
  total: number;
  active: number;
  completed: number;
  to_invoice: number;
  draft: number;
  cancelled: number;
}

interface CompanyStats {
  total: number;
  approved: number;
  with_access: number;
  xero_synced: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const [shipmentStats, setShipmentStats] = useState<ShipmentStats | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);
  const [activeOrders, setActiveOrders] = useState<ShipmentOrder[]>([]);
  const [toInvoiceOrders, setToInvoiceOrders] = useState<ShipmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shipmentStatsResult, dashResult, profile] = await Promise.all([
        fetchShipmentOrderStatsAction(),
        fetchDashboardShipmentsAction(),
        getCurrentUserProfileAction(),
      ]);

      if (!shipmentStatsResult.success) throw new Error(shipmentStatsResult.error);
      if (!dashResult) throw new Error('No response from dashboard action');
      if (!dashResult.success) throw new Error(dashResult.error);

      setShipmentStats(shipmentStatsResult.data);
      setActiveOrders(dashResult.data.active.map(toShipmentOrder));
      setToInvoiceOrders(dashResult.data.to_invoice.map(toShipmentOrder));
      setAccountType(profile.account_type);
      setCompanyName(profile.company_name);
      setCompanyId(profile.company_id);
      setProfileLoaded(true);

      // Only fetch company stats for AFU (staff) users
      if (profile.account_type === 'AFU') {
        const companyStatsResult = await fetchCompanyStatsAction();
        if (companyStatsResult.success) {
          setCompanyStats(companyStatsResult.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAfc = accountType === 'AFC';
  const statsLoading = shipmentStats == null || (!isAfc && companyStats == null);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Platform overview
          </p>
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Slot 1: Company card (AFC) | Total Shipments (AFU) */}
        {isAfc ? (
          <div className="bg-white rounded-xl border border-[var(--border)] p-4">
            {statsLoading ? (
              <div className="animate-pulse">
                <div className="w-9 h-9 rounded-lg bg-[var(--surface)]" />
                <div className="mt-3 h-5 w-3/4 rounded bg-[var(--surface)]" />
                <div className="mt-1.5 h-3 w-1/2 rounded bg-[var(--surface)]" />
              </div>
            ) : (
              <>
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
                <div className="mt-3">
                  <p className="text-base font-semibold text-[var(--text)] leading-tight truncate">
                    {companyName || companyId || '—'}
                  </p>
                  {companyId && (
                    <p className="text-xs font-mono text-[var(--text-muted)] mt-0.5">{companyId}</p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <KpiCard
            icon={<Truck className="w-5 h-5" />}
            label="Total Shipments"
            value={shipmentStats?.total ?? '—'}
            loading={statsLoading}
          />
        )}
        {/* Slot 2: Total Shipments (AFC) | Active Shipments (AFU) */}
        {isAfc ? (
          <KpiCard
            icon={<Truck className="w-5 h-5" />}
            label="Total Shipments"
            value={shipmentStats?.total ?? '—'}
            loading={statsLoading}
          />
        ) : (
          <KpiCard
            icon={<PackageCheck className="w-5 h-5" />}
            label="Active Shipments"
            value={shipmentStats?.active ?? '—'}
            loading={statsLoading}
            color="sky"
          />
        )}
        {/* Slot 3: Active Shipments (AFC) | Total Companies (AFU) */}
        {isAfc ? (
          <KpiCard
            icon={<PackageCheck className="w-5 h-5" />}
            label="Active Shipments"
            value={shipmentStats?.active ?? '—'}
            loading={statsLoading}
            color="sky"
          />
        ) : (
          <KpiCard
            icon={<Building2 className="w-5 h-5" />}
            label="Total Companies"
            value={companyStats?.total ?? '—'}
            loading={statsLoading}
            color="purple"
          />
        )}
        {/* Slot 4: Completed (AFC) | To Invoice (AFU) */}
        {isAfc ? (
          <KpiCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Completed"
            value={shipmentStats?.completed ?? '—'}
            loading={statsLoading}
            color="green"
          />
        ) : (
          <KpiCard
            icon={<FileEdit className="w-5 h-5" />}
            label="To Invoice"
            value={shipmentStats?.to_invoice ?? '—'}
            loading={statsLoading}
            color="amber"
          />
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <span className="font-medium">Error:</span> {error}
          <button
            onClick={() => load()}
            className="ml-auto text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Active Shipments — table on desktop, tap card on mobile */}
      <div>
        <h2 className="text-sm font-medium text-[var(--text-mid)] mb-3">Active Shipments</h2>

        {/* Mobile: tap card */}
        <div
          className="sm:hidden cursor-pointer rounded-xl border border-[var(--border)] bg-white p-5
                      flex items-center justify-between active:bg-[var(--surface)] transition-colors"
          onClick={() => router.push('/shipments?tab=active')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
              <Truck className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">Active Shipments</p>
              <p className="text-2xl font-semibold text-[var(--text)]">
                {shipmentStats?.active ?? '—'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
        </div>

        {/* Desktop: full table */}
        <div className="hidden sm:block">
          <ShipmentOrderTable orders={activeOrders} loading={loading || !profileLoaded} accountType={accountType} onRefresh={() => load()} />
        </div>
      </div>

      {/* To Invoice — hidden on mobile */}
      {toInvoiceOrders.length > 0 && (
        <div className="hidden sm:block">
          <h2 className="text-sm font-medium text-[var(--text-mid)] mb-3">
            To Invoice ({toInvoiceOrders.length})
          </h2>
          <ShipmentOrderTable orders={toInvoiceOrders} loading={loading || !profileLoaded} accountType={accountType} onRefresh={() => load()} />
        </div>
      )}
    </div>
  );
}
