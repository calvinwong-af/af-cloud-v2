'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2, AlertTriangle, Package, User, Pencil, Container,
} from 'lucide-react';
import {
  getGroundTransportOrderAction,
  cancelGroundTransportOrderAction,
} from '@/app/actions/ground-transport';
import type { GroundTransportOrder, GroundTransportLeg } from '@/app/actions/ground-transport';
import { fetchCitiesAction, fetchHaulageAreasAction } from '@/app/actions/geography';
import { getCurrentUserProfileAction } from '@/app/actions/users';
import type { City, HaulageArea } from '@/lib/types';
import {
  GT_STATUS_STYLES,
  StatusDropdown,
  GTSectionCard,
  GTDataRow,
  EditOrderModal,
  AddLegModal,
  EditLegModal,
  LegsCard,
} from './_components';

const LEG_TYPE_LABELS: Record<string, string> = {
  first_mile:   'First Mile',
  last_mile:    'Last Mile',
  standalone:   'Standalone',
  distribution: 'Distribution',
};

export default function GroundTransportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<GroundTransportOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [haulageAreas, setHaulageAreas] = useState<HaulageArea[]>([]);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const [showAddLeg, setShowAddLeg] = useState(false);
  const [editingLeg, setEditingLeg] = useState<GroundTransportLeg | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const result = await getGroundTransportOrderAction(orderId);
      if (!result) { setError('No response'); return; }
      if (result.success) {
        setOrder(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch {
      setError('Failed to load order');
    }
  }, [orderId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [profile, citiesRes, areasRes] = await Promise.all([
        getCurrentUserProfileAction(),
        fetchCitiesAction(),
        fetchHaulageAreasAction(),
      ]);
      setAccountType(profile.account_type);
      if (profile.account_type !== 'AFU') {
        router.replace('/dashboard');
        return;
      }
      if (citiesRes.success) setCities(citiesRes.data);
      if (areasRes.success) setHaulageAreas(areasRes.data);
      await loadOrder();
      setLoading(false);
    }
    init();
  }, [loadOrder, router]);

  useEffect(() => {
    if (order) document.title = `${order.transport_order_id} | Ground Transport`;
    return () => { document.title = 'AcceleFreight'; };
  }, [order]);

  async function handleCancel() {
    if (!order) return;
    setCancelling(true);
    try {
      const result = await cancelGroundTransportOrderAction(order.transport_order_id);
      if (result && result.success) loadOrder();
    } catch { /* ignore */ }
    setCancelling(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--sky)]" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error ?? 'Order not found'}
          <button onClick={() => { setError(null); setLoading(true); loadOrder().then(() => setLoading(false)); }} className="ml-auto underline">Retry</button>
        </div>
      </div>
    );
  }

  const canCancel = !['completed', 'cancelled'].includes(order.status);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold font-mono text-[var(--text)]">
                {order.transport_order_id}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                order.transport_type === 'haulage' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {order.transport_type.toUpperCase()}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${GT_STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap text-sm text-[var(--text-mid)]">
              <span>{LEG_TYPE_LABELS[order.leg_type] ?? order.leg_type}</span>
              {order.parent_shipment_id && (
                <>
                  <span className="text-[var(--border)]">·</span>
                  <button
                    onClick={() => window.open(`/shipments/${order.parent_shipment_id}`, '_blank')}
                    className="font-mono text-xs text-[var(--sky)] hover:underline"
                  >
                    {order.parent_shipment_id}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusDropdown order={order} onUpdated={loadOrder} />
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling…' : 'Cancel Order'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Order Details */}
        <GTSectionCard
          title="Order Details"
          icon={<Container className="w-4 h-4" />}
          action={
            accountType === 'AFU' ? (
              <button
                onClick={() => setShowEditOrder(true)}
                className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
                title="Edit order"
              >
                <Pencil className="w-3 h-3" />
              </button>
            ) : undefined
          }
        >
          <GTDataRow label="Transport Type" value={order.transport_type} />
          <GTDataRow label="Leg Type" value={LEG_TYPE_LABELS[order.leg_type]} />
          <GTDataRow label="Parent Shipment" value={order.parent_shipment_id} mono />
          <GTDataRow label="Vendor" value={order.vendor_id} mono />
          <GTDataRow label="Equipment Type" value={order.equipment_type} />
          <GTDataRow label="Equipment Number" value={order.equipment_number} mono />
          {order.transport_type === 'haulage' && (
            <>
              <GTDataRow label="Detention Mode" value={order.detention_mode} />
              <GTDataRow label="Detention Free Days" value={order.detention_free_days} />
            </>
          )}
          <GTDataRow label="Notes" value={order.notes} />
        </GTSectionCard>

        {/* Cargo */}
        <GTSectionCard
          title="Cargo"
          icon={<Package className="w-4 h-4" />}
          action={
            accountType === 'AFU' ? (
              <button
                onClick={() => setShowEditOrder(true)}
                className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
                title="Edit cargo"
              >
                <Pencil className="w-3 h-3" />
              </button>
            ) : undefined
          }
        >
          <GTDataRow label="Description" value={order.cargo_description} />
          {order.container_numbers.length > 0 && (
            <div className="py-1.5 border-b border-[var(--border)]">
              <span className="text-xs text-[var(--text-muted)]">Containers</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {order.container_numbers.map((cn) => (
                  <span key={cn} className="px-2 py-0.5 text-xs font-mono bg-[var(--surface)] border border-[var(--border)] rounded">
                    {cn}
                  </span>
                ))}
              </div>
            </div>
          )}
          <GTDataRow label="Weight" value={order.weight_kg != null ? `${order.weight_kg} kg` : null} />
          <GTDataRow label="Volume" value={order.volume_cbm != null ? `${order.volume_cbm} CBM` : null} />
        </GTSectionCard>

        {/* Driver & Vehicle */}
        <GTSectionCard
          title="Driver & Vehicle"
          icon={<User className="w-4 h-4" />}
          action={
            accountType === 'AFU' ? (
              <button
                onClick={() => setShowEditOrder(true)}
                className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
                title="Edit driver"
              >
                <Pencil className="w-3 h-3" />
              </button>
            ) : undefined
          }
        >
          <GTDataRow label="Driver Name" value={order.driver_name} />
          <GTDataRow label="Driver Contact" value={order.driver_contact} />
          <GTDataRow label="Vehicle Plate" value={order.vehicle_plate} mono />
          {!order.driver_name && !order.driver_contact && !order.vehicle_plate && (
            <p className="text-sm text-[var(--text-muted)] italic">No driver assigned</p>
          )}
        </GTSectionCard>
      </div>

      {/* Legs */}
      <LegsCard
        order={order}
        onAddLeg={() => setShowAddLeg(true)}
        onEditLeg={setEditingLeg}
      />

      {/* Modals */}
      {showEditOrder && (
        <EditOrderModal
          order={order}
          onSaved={loadOrder}
          onClose={() => setShowEditOrder(false)}
        />
      )}

      {showAddLeg && (
        <AddLegModal
          transportOrderId={order.transport_order_id}
          nextSequence={(order.legs?.length ?? 0) + 1}
          cities={cities}
          haulageAreas={haulageAreas}
          onSaved={loadOrder}
          onClose={() => setShowAddLeg(false)}
        />
      )}

      {editingLeg && (
        <EditLegModal
          transportOrderId={order.transport_order_id}
          leg={editingLeg}
          cities={cities}
          haulageAreas={haulageAreas}
          onSaved={loadOrder}
          onClose={() => setEditingLeg(null)}
        />
      )}
    </div>
  );
}
