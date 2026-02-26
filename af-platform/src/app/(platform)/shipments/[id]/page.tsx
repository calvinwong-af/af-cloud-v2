'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Ship, Plane, Package, MapPin, Calendar,
  Users, FileText, AlertTriangle, Loader2, Hash,
  Container, Weight,
} from 'lucide-react';
import { fetchShipmentOrderDetailAction } from '@/app/actions/shipments';
import { formatDate } from '@/lib/utils';
import type { ShipmentOrder } from '@/lib/types';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLOR, ORDER_TYPE_LABELS } from '@/lib/types';

// ─── Status styles ───────────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function DataRow({ label, value, mono = false }: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-[var(--border)] last:border-0">
      <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{label}</span>
      <span className={`text-sm text-[var(--text)] text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-[var(--text-muted)] italic">{message}</p>;
}

// ─── Route card ───────────────────────────────────────────────────────────────

function RouteCard({ order }: { order: ShipmentOrder }) {
  const isAir = order.order_type === 'AIR';
  const origin = order.origin;
  const dest = order.destination;

  // Prefer port code as primary; fall back to label if no code available
  const originCode = origin?.port_un_code ?? origin?.label ?? '—';
  const originName = origin?.port_un_code && origin?.label && origin.label !== origin.port_un_code
    ? origin.label
    : origin?.country_code ?? null;

  const destCode = dest?.port_un_code ?? dest?.label ?? '—';
  const destName = dest?.port_un_code && dest?.label && dest.label !== dest.port_un_code
    ? dest.label
    : dest?.country_code ?? null;

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[var(--text-muted)]">
          <MapPin className="w-4 h-4" />
        </span>
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Route</h2>
      </div>

      {/* Port codes row — aligned with icon */}
      <div className="flex items-center">
        {/* Origin */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[var(--text-muted)] mb-1">Origin</div>
          <div className="text-2xl font-bold font-mono text-[var(--text)] tracking-wide">
            {originCode}
          </div>
          {originName && (
            <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{originName}</div>
          )}
        </div>

        {/* Connecting line + icon */}
        <div className="flex items-center flex-shrink-0 mx-4">
          <div className="h-px w-12 bg-[var(--border)]" />
          <div className="p-2 rounded-full bg-[var(--sky-pale)] mx-2">
            {isAir
              ? <Plane className="w-4 h-4 text-[var(--sky)]" />
              : <Ship className="w-4 h-4 text-[var(--sky)]" />}
          </div>
          <div className="h-px w-12 bg-[var(--border)]" />
        </div>

        {/* Destination */}
        <div className="flex-1 min-w-0 text-right">
          <div className="text-xs text-[var(--text-muted)] mb-1">Destination</div>
          <div className="text-2xl font-bold font-mono text-[var(--text)] tracking-wide">
            {destCode}
          </div>
          {destName && (
            <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{destName}</div>
          )}
        </div>
      </div>

      {/* Incoterm pill */}
      {order.incoterm_code && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Incoterm</span>
          <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs font-mono font-semibold text-[var(--text-mid)]">
            {order.incoterm_code}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Type details card ────────────────────────────────────────────────────────

function TypeDetailsCard({ order }: { order: ShipmentOrder }) {
  const td = order.type_details;

  if (!td) {
    return (
      <SectionCard title="Cargo Details" icon={<Container className="w-4 h-4" />}>
        <EmptyState message="No cargo details recorded" />
      </SectionCard>
    );
  }

  if (td.type === 'SEA_FCL') {
    return (
      <SectionCard title="Containers" icon={<Container className="w-4 h-4" />}>
        {td.containers.length === 0
          ? <EmptyState message="No containers recorded" />
          : (
            <div className="space-y-2">
              {td.containers.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs font-mono font-semibold text-[var(--text-mid)]">
                      {c.container_size}
                    </span>
                    <span className="text-sm text-[var(--text-mid)]">{c.container_type}</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text)]">× {c.quantity}</span>
                </div>
              ))}
            </div>
          )}
        <p className="text-xs text-[var(--text-muted)] mt-3">Container and seal numbers assigned at booking.</p>
      </SectionCard>
    );
  }

  if (td.type === 'SEA_LCL' || td.type === 'AIR') {
    const totalWeight = td.packages.reduce((sum, p) => sum + (p.gross_weight_kg ?? 0), 0);
    const totalVolume = td.packages.reduce((sum, p) => sum + (p.volume_cbm ?? 0), 0);

    return (
      <SectionCard title="Packages" icon={<Package className="w-4 h-4" />}>
        {td.packages.length === 0
          ? <EmptyState message="No packages recorded" />
          : (
            <div className="space-y-2 mb-3">
              {td.packages.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text)]">{p.quantity}×</span>
                    <span className="text-sm text-[var(--text-mid)]">{p.packaging_type}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    {p.gross_weight_kg != null && <span>{p.gross_weight_kg} kg</span>}
                    {p.volume_cbm != null && <span>{p.volume_cbm} CBM</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

        {/* Totals row */}
        {(totalWeight > 0 || totalVolume > 0) && (
          <div className="flex items-center gap-4 pt-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)] mr-auto">Totals</span>
            {totalWeight > 0 && (
              <div className="flex items-center gap-1 text-xs text-[var(--text-mid)]">
                <Weight className="w-3 h-3" />
                <span className="font-semibold">{totalWeight.toFixed(2)} kg</span>
              </div>
            )}
            {totalVolume > 0 && (
              <div className="text-xs text-[var(--text-mid)]">
                <span className="font-semibold">{totalVolume.toFixed(3)} CBM</span>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Cargo Details" icon={<Package className="w-4 h-4" />}>
      <EmptyState message="Details not available for this order type" />
    </SectionCard>
  );
}

// ─── Parties card ─────────────────────────────────────────────────────────────

function PartiesCard({ order }: { order: ShipmentOrder }) {
  const parties = order.parties;
  const hasParties = parties && (parties.shipper || parties.consignee || parties.notify_party);

  return (
    <SectionCard title="Parties" icon={<Users className="w-4 h-4" />}>
      {!hasParties
        ? <EmptyState message="Parties not yet assigned" />
        : (
          <div className="space-y-4">
            {parties.shipper && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Shipper</div>
                <div className="text-sm text-[var(--text)]">{parties.shipper.name}</div>
                {parties.shipper.address && <div className="text-xs text-[var(--text-muted)]">{parties.shipper.address}</div>}
              </div>
            )}
            {parties.consignee && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Consignee</div>
                <div className="text-sm text-[var(--text)]">{parties.consignee.name}</div>
                {parties.consignee.address && <div className="text-xs text-[var(--text-muted)]">{parties.consignee.address}</div>}
              </div>
            )}
            {parties.notify_party && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Notify Party</div>
                <div className="text-sm text-[var(--text)]">{parties.notify_party.name}</div>
              </div>
            )}
          </div>
        )}
    </SectionCard>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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

  const isV2 = order.data_version === 2;
  const statusLabel = SHIPMENT_STATUS_LABELS[order.status] ?? `${order.status}`;
  const statusColor = SHIPMENT_STATUS_COLOR[order.status] ?? 'gray';
  const statusStyle = STATUS_STYLES[statusColor] ?? STATUS_STYLES.gray;

  return (
    <div className="p-6 space-y-5 max-w-4xl">

      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Shipments
      </button>

      {/* Header */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold font-mono text-[var(--text)]">
                {order.quotation_id}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyle}`}>
                {statusLabel}
              </span>
              {!isV2 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded font-mono">
                  Legacy V1
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-sm text-[var(--text-mid)]">
                {ORDER_TYPE_LABELS[order.order_type] ?? order.order_type}
              </span>
              <span className="text-[var(--border)]">·</span>
              <span className="text-sm text-[var(--text-mid)]">{order.transaction_type}</span>
              {order.tracking_id && (
                <>
                  <span className="text-[var(--border)]">·</span>
                  <span className="text-xs font-mono text-[var(--text-muted)]">{order.tracking_id}</span>
                </>
              )}
            </div>
          </div>

          {/* Company */}
          {order.company_id && (
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-[var(--text-muted)] mb-0.5">Customer</div>
              <div className="text-sm font-semibold text-[var(--text)]">
                {order._company_name ?? order.company_id}
              </div>
              {order._company_name && (
                <div className="text-xs font-mono text-[var(--text-muted)]">{order.company_id}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Route */}
      <RouteCard order={order} />

      {/* Two-column grid for the detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Cargo */}
        <SectionCard title="Cargo" icon={<Package className="w-4 h-4" />}>
          {!order.cargo
            ? <EmptyState message="No cargo description" />
            : (
              <>
                {order.cargo.description && (
                  <div className="mb-3">
                    <div className="text-xs text-[var(--text-muted)] mb-1.5">Description</div>
                    <div className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed bg-[var(--surface)] rounded-lg px-3 py-2.5 border border-[var(--border)]">
                      {order.cargo.description}
                    </div>
                  </div>
                )}
                <DataRow label="HS Code" value={order.cargo.hs_code} mono />
                {order.cargo.dg_classification && (
                  <DataRow
                    label="DG Classification"
                    value={`Class ${order.cargo.dg_classification.class}${order.cargo.dg_classification.un_number ? ` · ${order.cargo.dg_classification.un_number}` : ''}`}
                  />
                )}
              </>
            )}
        </SectionCard>

        {/* Dates */}
        <SectionCard title="Dates" icon={<Calendar className="w-4 h-4" />}>
          <DataRow label="Cargo Ready" value={formatDate(order.cargo_ready_date)} />
          <DataRow label="Created" value={formatDate(order.created)} />
          <DataRow label="Updated" value={formatDate(order.updated)} />
        </SectionCard>

        {/* Type details — containers or packages */}
        <TypeDetailsCard order={order} />

        {/* Parties */}
        <PartiesCard order={order} />

        {/* Customs — only if there are events */}
        {order.customs_clearance.length > 0 && (
          <SectionCard title="Customs Clearance" icon={<FileText className="w-4 h-4" />}>
            <div className="space-y-2">
              {order.customs_clearance.map((event, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                  <span className="text-xs text-[var(--text-mid)]">
                    {event.type} — {event.port_un_code}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    event.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
                    : event.status === 'EXCEPTION' ? 'bg-red-100 text-red-700'
                    : event.status === 'IN_PROGRESS' ? 'bg-sky-100 text-sky-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>
                    {event.status}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Meta */}
        <SectionCard title="Reference" icon={<Hash className="w-4 h-4" />}>
          <DataRow label="Order ID" value={order.quotation_id} mono />
          <DataRow label="Tracking ID" value={order.tracking_id} mono />
          <DataRow label="Data Version" value={isV2 ? 'V2 (Native)' : 'V1 (Legacy)'} />
          {order.files.length > 0 && (
            <DataRow label="Files" value={`${order.files.length} attached`} />
          )}
        </SectionCard>

      </div>
    </div>
  );
}
