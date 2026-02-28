/**
 * /dashboard — Platform overview
 *
 * KPI cards (shipment + company stats) and a recent shipments table.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, Building2, PackageCheck, CheckCircle2, FileEdit, RefreshCw } from 'lucide-react';
import { fetchShipmentOrderStatsAction, fetchShipmentOrdersAction } from '@/app/actions/shipments';
import { fetchCompanyStatsAction } from '@/app/actions/companies';
import { getCurrentUserProfileAction } from '@/app/actions/users';
import { KpiCard } from '@/components/shared/KpiCard';
import { ShipmentOrderTable } from '@/components/shipments/ShipmentOrderTable';
import type { ShipmentOrder } from '@/lib/types';

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
  const [shipmentStats, setShipmentStats] = useState<ShipmentStats | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<ShipmentOrder[]>([]);
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
      const [shipmentStatsResult, ordersResult, profile] = await Promise.all([
        fetchShipmentOrderStatsAction(),
        fetchShipmentOrdersAction({ limit: 10 }),
        getCurrentUserProfileAction(),
      ]);

      if (!shipmentStatsResult.success) throw new Error(shipmentStatsResult.error);
      if (!ordersResult.success) throw new Error(ordersResult.error);

      setShipmentStats(shipmentStatsResult.data);
      setRecentOrders(ordersResult.data.orders);
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

      {/* Recent Shipments */}
      <div>
        <h2 className="text-sm font-medium text-[var(--text-mid)] mb-3">Recent Shipments</h2>
        <ShipmentOrderTable orders={recentOrders} loading={loading || !profileLoaded} accountType={accountType} onRefresh={() => load()} />
      </div>
    </div>
  );
}
