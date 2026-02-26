/**
 * /shipments/[id] — ShipmentOrder detail view
 *
 * Renders full assembled ShipmentOrder. V1 records use the assembly layer;
 * V2 records are read directly.
 *
 * Currently read-only. Write/edit functionality comes in the next phase.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Ship, Plane, Truck, Package, MapPin, Calendar,
  Users, FileText, AlertTriangle, Loader2
} from 'lucide-react';
import { fetchShipmentOrderDetailAction } from '@/app/actions/shipments';
import { formatDate } from '@/lib/utils';
import type { ShipmentOrder } from '@/lib/types';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLOR, ORDER_TYPE_LABELS } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  gray:   'bg-gray-100 text-gray-700',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue:   'bg-blue-100 text-blue-800',
  orange: 'bg-orange-100 text-orange-800',
  teal:   'bg-teal-100 text-teal-800',
  sky:    'bg-sky-100 text-sky-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  purple: 'bg-purple-100 text-purple-800',
  red:    'bg-red-100 text-red-700',
  green:  'bg-emerald-100 text-emerald-800',
};

export default function ShipmentOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quotationId = params.id as string;

  const [order, setOrder] = useState<ShipmentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await fetchShipmentOrderDetailAction(quotationId);
      if (result.success) {
        setOrder(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }
    load();
  }, [quotationId]);

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
          {error ?? 'Shipment order not found'}
        </div>
      </div>
    );
  }

  const statusLabel = SHIPMENT_STATUS_LABELS[order.status] ?? `${order.status}`;
  const statusColor = SHIPMENT_STATUS_COLOR[order.status] ?? 'gray';
  const statusStyle = STATUS_STYLES[statusColor] ?? STATUS_STYLES.gray;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Shipments
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold font-mono text-[var(--text)]">
                {order.quotation_id}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle}`}>
                {statusLabel}
              </span>
              {order.data_version === 1 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">
                  Legacy V1
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-[var(--text-muted)]">
              <span>{ORDER_TYPE_LABELS[order.order_type] ?? order.order_type}</span>
              <span>·</span>
              <span>{order.transaction_type}</span>
              {order.incoterm_code && (
                <>
                  <span>·</span>
                  <span className="font-mono">{order.incoterm_code}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Route card */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">Route</h2>
        <div className="flex items-center gap-4">
          <LocationDisplay label="Origin" location={order.origin} />
          <div className="flex-1 flex items-center justify-center">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <div className="mx-3 p-1.5 rounded-full bg-[var(--sky-pale)]">
              {order.order_type === 'AIR'
                ? <Plane className="w-4 h-4 text-[var(--sky)]" />
                : order.order_type === 'GROUND'
                ? <Truck className="w-4 h-4 text-[var(--sky)]" />
                : <Ship className="w-4 h-4 text-[var(--sky)]" />}
            </div>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <LocationDisplay label="Destination" location={order.destination} align="right" />
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cargo */}
        {order.cargo && (
          <DetailCard title="Cargo" icon={<Package className="w-4 h-4" />}>
            <DetailRow label="Description" value={order.cargo.description} />
            <DetailRow label="HS Code" value={order.cargo.hs_code} />
            {order.cargo.dg_classification && (
              <DetailRow
                label="DG Class"
                value={`Class ${order.cargo.dg_classification.class}${order.cargo.dg_classification.un_number ? ` (${order.cargo.dg_classification.un_number})` : ''}`}
              />
            )}
          </DetailCard>
        )}

        {/* Dates */}
        <DetailCard title="Dates" icon={<Calendar className="w-4 h-4" />}>
          <DetailRow label="Cargo Ready" value={formatDate(order.cargo_ready_date)} />
          <DetailRow label="Created" value={formatDate(order.created)} />
          <DetailRow label="Updated" value={formatDate(order.updated)} />
        </DetailCard>

        {/* Parties */}
        {order.parties && (
          <DetailCard title="Parties" icon={<Users className="w-4 h-4" />}>
            {order.parties.shipper && (
              <DetailRow label="Shipper" value={order.parties.shipper.name} />
            )}
            {order.parties.consignee && (
              <DetailRow label="Consignee" value={order.parties.consignee.name} />
            )}
            {order.parties.notify_party && (
              <DetailRow label="Notify Party" value={order.parties.notify_party.name} />
            )}
          </DetailCard>
        )}

        {/* Customs */}
        {order.customs_clearance.length > 0 && (
          <DetailCard title="Customs Clearance" icon={<FileText className="w-4 h-4" />}>
            {order.customs_clearance.map((event, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-xs text-[var(--text-mid)]">
                  {event.type} — {event.port_un_code}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${event.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
                  : event.status === 'EXCEPTION' ? 'bg-red-100 text-red-700'
                  : event.status === 'IN_PROGRESS' ? 'bg-sky-100 text-sky-700'
                  : 'bg-gray-100 text-gray-600'}`}>
                  {event.status}
                </span>
              </div>
            ))}
          </DetailCard>
        )}
      </div>

      {/* Type details */}
      {order.type_details && (
        <div className="bg-white border border-[var(--border)] rounded-xl p-5">
          <h2 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
            {ORDER_TYPE_LABELS[order.order_type]} Details
          </h2>
          <TypeDetailsView typeDetails={order.type_details} />
        </div>
      )}

      {/* Files count */}
      {order.files.length > 0 && (
        <div className="text-sm text-[var(--text-muted)]">
          <FileText className="w-4 h-4 inline mr-1.5" />
          {order.files.length} file{order.files.length !== 1 ? 's' : ''} attached
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LocationDisplay({
  label,
  location,
  align = 'left',
}: {
  label: string;
  location: ShipmentOrder['origin'];
  align?: 'left' | 'right';
}) {
  return (
    <div className={`${align === 'right' ? 'text-right' : ''}`}>
      <div className="text-xs text-[var(--text-muted)] mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="font-medium text-[var(--text)]">
          {location?.label ?? location?.port_un_code ?? '—'}
        </span>
      </div>
      {location?.port_un_code && location.label !== location.port_un_code && (
        <div className="text-xs font-mono text-[var(--text-muted)] mt-0.5">
          {location.port_un_code}
        </div>
      )}
      {location?.country_code && (
        <div className="text-xs text-[var(--text-muted)]">{location.country_code}</div>
      )}
    </div>
  );
}

function DetailCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <h2 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{label}</span>
      <span className="text-sm text-[var(--text)] text-right">{value}</span>
    </div>
  );
}

function TypeDetailsView({ typeDetails }: { typeDetails: ShipmentOrder['type_details'] }) {
  if (!typeDetails) return null;

  if (typeDetails.type === 'SEA_FCL') {
    return (
      <div className="space-y-2">
        {typeDetails.containers.map((c, i) => (
          <div key={i} className="flex items-center gap-3 text-sm text-[var(--text-mid)]">
            <span className="font-mono bg-[var(--surface)] px-2 py-0.5 rounded">{c.container_size}</span>
            <span>{c.container_type}</span>
            <span>× {c.quantity}</span>
            {c.container_numbers.length > 0 && (
              <span className="font-mono text-xs text-[var(--text-muted)]">
                {c.container_numbers.join(', ')}
              </span>
            )}
          </div>
        ))}
        {typeDetails.containers.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">No container details recorded</p>
        )}
      </div>
    );
  }

  if (typeDetails.type === 'SEA_LCL' || typeDetails.type === 'AIR') {
    const packages = typeDetails.packages;
    return (
      <div className="space-y-1.5">
        {packages.map((p, i) => (
          <div key={i} className="flex items-center gap-3 text-sm text-[var(--text-mid)]">
            <span>{p.quantity}× {p.packaging_type}</span>
            {p.gross_weight_kg != null && <span>{p.gross_weight_kg} kg</span>}
            {p.volume_cbm != null && <span>{p.volume_cbm} CBM</span>}
          </div>
        ))}
        {typeDetails.type === 'AIR' && typeDetails.chargeable_weight != null && (
          <div className="text-sm text-[var(--text-mid)]">
            Chargeable weight: <strong>{typeDetails.chargeable_weight} kg</strong>
          </div>
        )}
      </div>
    );
  }

  return <p className="text-sm text-[var(--text-muted)]">Details not available for this order type</p>;
}

