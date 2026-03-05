'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Package, Calendar, Upload,
  FileText, AlertTriangle, Loader2, Hash,
  ClipboardList, Pencil,
} from 'lucide-react';
import { fetchShipmentOrderDetailAction, fetchPortsAction } from '@/app/actions/shipments';
import { patchShipmentCargoAction, fetchShipmentTasksAction } from '@/app/actions/shipments-write';
import { getCurrentUserProfileAction } from '@/app/actions/users';
import { formatDate } from '@/lib/utils';
import type { ShipmentOrder } from '@/lib/types';
import type { Port } from '@/lib/ports';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLOR, ORDER_TYPE_LABELS } from '@/lib/types';
import ShipmentTasks from '@/components/shipments/ShipmentTasks';
import ShipmentFilesTab from '@/components/shipments/ShipmentFilesTab';
import BLPartyDiffModal from '@/components/shipments/BLPartyDiffModal';
import DocumentParseModal from '@/components/shipments/DocumentParseModal';
import RouteNodeTimeline from '@/components/shipments/RouteNodeTimeline';
import type { ScopeFlags } from '@/app/actions/ground-transport';
import {
  STATUS_STYLES,
  SectionCard,
  DataRow,
  EmptyState,
  RouteCard,
  TypeDetailsCard,
  StatusCard,
  PartiesCard,
  EditPartiesModal,
  CompanyReassignModal,
  TransportCard,
  TransportEditModal,
  ScopeFlagsCard,
  GroundTransportReconcileCard,
} from './_components';
import { createDocResultHandler } from './_doc-handler';
import ShipmentRouteMapCard from '@/components/maps/ShipmentRouteMapCard';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ShipmentOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quotationId = params.id as string;

  const [order, setOrder] = useState<ShipmentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showDocParseModal, setShowDocParseModal] = useState(false);
  const [ports, setPorts] = useState<{ un_code: string; name: string; country: string; port_type: string; has_terminals: boolean; terminals: Array<{ terminal_id: string; name: string; is_default: boolean }> }[]>([]);
  const [diffParty, setDiffParty] = useState<'shipper' | 'consignee' | null>(null);
  const [showEditParties, setShowEditParties] = useState(false);
  const [showTransportEdit, setShowTransportEdit] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'files'>('overview');
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);
  const [routeTimelineRefreshKey, setRouteTimelineRefreshKey] = useState(0);
  const [isDgEditing, setIsDgEditing] = useState(false);
  const [isDgValue, setIsDgValue] = useState(false);
  const [dgDescription, setDgDescription] = useState('');
  const [isSavingDg, setIsSavingDg] = useState(false);
  const [routePolEta, setRoutePolEta] = useState<string | null>(null);
  const [routePolEtd, setRoutePolEtd] = useState<string | null>(null);
  const [routePolAta, setRoutePolAta] = useState<string | null>(null);
  const [routePolAtd, setRoutePolAtd] = useState<string | null>(null);
  const [routePodEta, setRoutePodEta] = useState<string | null>(null);
  const [routePodAta, setRoutePodAta] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    const result = await fetchShipmentOrderDetailAction(quotationId);
    if (result.success) {
      setOrder(result.data);
    } else {
      setError(result.error);
    }
  }, [quotationId]);

  const loadRouteTimings = useCallback(async () => {
    try {
      const result = await fetchShipmentTasksAction(quotationId);
      if (result && result.success && result.data) {
        const polTask = result.data.find(t => t.task_type === 'POL' && t.mode === 'TRACKED');
        const podTask = result.data.find(t => t.task_type === 'POD' && t.mode === 'TRACKED');

        setRoutePolEta(polTask?.scheduled_start ?? null);
        setRoutePolEtd(polTask?.scheduled_end ?? null);
        setRoutePolAta(polTask?.actual_start ?? null);
        setRoutePolAtd(polTask?.actual_end ?? null);
        setRoutePodEta(podTask?.scheduled_start ?? null);
        setRoutePodAta(podTask?.actual_start ?? null);
      }
    } catch { /* non-critical */ }
  }, [quotationId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [, profile, , portsResult] = await Promise.all([
        loadOrder(),
        getCurrentUserProfileAction(),
        loadRouteTimings(),
        fetchPortsAction(),
      ]);
      setPorts(portsResult);
      setAccountType(profile.account_type);
      setUserRole(profile.role ?? null);
      setLoading(false);
    }
    load();
  }, [loadOrder, loadRouteTimings]);

  useEffect(() => {
    if (order) {
      document.title = `${order.quotation_id} | AcceleFreight`;
    }
    return () => {
      document.title = 'AcceleFreight';
    };
  }, [order]);

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

  // Extract vessel info — may live on flat fields (V1) or inside booking dict (V2)
  const bk = (order.booking ?? {}) as Record<string, unknown>;
  const vesselName: string | null =
    ((order as unknown as Record<string, unknown>).vessel_name as string) ?? (bk.vessel_name as string) ?? null;
  const voyageNumber: string | null =
    ((order as unknown as Record<string, unknown>).voyage_number as string) ?? (bk.voyage_number as string) ?? null;

  return (
    <div className="p-6 space-y-5 max-w-4xl">



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
              <div className="flex items-center gap-1.5 justify-end">
                <div className="text-sm font-semibold text-[var(--text)]">
                  {order._company_name ?? order.company_id}
                </div>
                {accountType === 'AFU' && (
                  <button
                    onClick={() => setShowCompanyModal(true)}
                    className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
                    title="Reassign company"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              {order._company_name && (
                <div className="text-xs font-mono text-[var(--text-muted)]">{order.company_id}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Route */}
      <RouteCard
        order={order}
        accountType={accountType}
        polEta={routePolEta}
        polEtd={routePolEtd}
        polAta={routePolAta}
        polAtd={routePolAtd}
        podEta={routePodEta}
        podAta={routePodAta}
        vesselName={vesselName}
        voyageNumber={voyageNumber}
        ports={ports as Port[]}
        onPortUpdated={() => { loadOrder(); }}
      />

      {/* Route Map */}
      <ShipmentRouteMapCard order={order} ports={ports as Port[]} />

      {/* Upload Document button — AFU, status >= 2001 (Confirmed+) */}
      {accountType === 'AFU' && order.status >= 2001 && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowDocParseModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--sky)] border border-[var(--sky)] rounded-lg hover:bg-[var(--sky-mist)] transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Document
          </button>
        </div>
      )}

      {/* Status Management */}
      <StatusCard order={order} onReload={loadOrder} accountType={accountType} />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'overview'
              ? 'border-[var(--sky)] text-[var(--sky)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'tasks'
              ? 'border-[var(--sky)] text-[var(--sky)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Tasks
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'files'
              ? 'border-[var(--sky)] text-[var(--sky)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Files
          {(fileCount !== null ? fileCount : 0) > 0 && (
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none ${
              activeTab === 'files' ? 'bg-[var(--sky)] text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]'
            }`}>
              {fileCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {/* ShipmentFilesTab is always mounted (hidden when inactive) so the file count badge populates on page load */}
      <div style={{ display: activeTab === 'files' ? undefined : 'none' }}>
        <ShipmentFilesTab
          shipmentId={order.quotation_id}
          userRole={accountType === 'AFU' ? 'AFU' : (userRole ?? 'AFC_USER')}
          ports={ports}
          refreshKey={filesRefreshKey}
          onBLUpdated={loadOrder}
          onFileCountChange={setFileCount}
          onDocApplied={() => {
            loadRouteTimings();
            setRouteTimelineRefreshKey(k => k + 1);
          }}
        />
      </div>

      {activeTab === 'tasks' ? (
        <div className="space-y-4">
          <RouteNodeTimeline
            shipmentId={order.quotation_id}
            accountType={accountType}
            userRole={userRole}
            refreshKey={routeTimelineRefreshKey}
            polAta={routePolAta}
            polAtd={routePolAtd}
            podAta={routePodAta}
          />
          <ShipmentTasks
            shipmentId={order.quotation_id}
            orderType={order.order_type}
            accountType={accountType}
            vesselName={vesselName}
            voyageNumber={voyageNumber}
            onTimingChanged={() => { loadRouteTimings(); loadOrder(); setRouteTimelineRefreshKey(k => k + 1); }}
          />
        </div>
      ) : activeTab === 'files' ? null : (

      /* Two-column grid for the detail cards */
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

                {/* DG status */}
                {isDgEditing ? (
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDgValue}
                        onChange={e => setIsDgValue(e.target.checked)}
                        className="rounded border-[var(--border)]"
                      />
                      <span className="text-sm text-[var(--text)]">Dangerous Goods (DG)</span>
                    </label>
                    {isDgValue && (
                      <textarea
                        value={dgDescription}
                        onChange={e => setDgDescription(e.target.value)}
                        placeholder="DG description (optional)"
                        rows={2}
                        className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--sky)] resize-none"
                      />
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setIsSavingDg(true);
                          const res = await patchShipmentCargoAction(
                            order.quotation_id,
                            isDgValue,
                            isDgValue ? (dgDescription || null) : null,
                          );
                          setIsSavingDg(false);
                          if (res.success) {
                            setIsDgEditing(false);
                            loadOrder();
                          }
                        }}
                        disabled={isSavingDg}
                        className="px-3 py-1 text-xs font-medium bg-[var(--sky)] text-white rounded-lg disabled:opacity-50"
                      >
                        {isSavingDg ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setIsDgEditing(false)}
                        className="px-3 py-1 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--text-muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      {order.cargo.is_dg ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>
                          DG
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">Not DG</span>
                      )}
                      {order.cargo.is_dg && order.cargo.dg_description && (
                        <span className="text-xs text-[var(--text-mid)]">{order.cargo.dg_description}</span>
                      )}
                    </div>
                    {accountType === 'AFU' && (
                      <button
                        onClick={() => {
                          setIsDgValue(order.cargo?.is_dg ?? false);
                          setDgDescription(order.cargo?.dg_description ?? '');
                          setIsDgEditing(true);
                        }}
                        className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
                        title="Edit DG status"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {order.cargo.dg_classification && (
                  <DataRow
                    label="DG Classification"
                    value={`Class ${order.cargo.dg_classification.class}${order.cargo.dg_classification.un_number ? ` · ${order.cargo.dg_classification.un_number}` : ''}`}
                  />
                )}
              </>
            )}
        </SectionCard>

        {/* Transport — vessel/voyage from booking dict or flat fields */}
        <TransportCard
          order={order}
          vesselName={vesselName}
          voyageNumber={voyageNumber}
          etd={routePolEtd}
          accountType={accountType}
          onEdit={accountType === 'AFU' ? () => setShowTransportEdit(true) : undefined}
        />

        {/* Dates */}
        <SectionCard title="Dates" icon={<Calendar className="w-4 h-4" />}>
          <DataRow label="Cargo Ready" value={formatDate(order.cargo_ready_date)} />
          <DataRow label="Created" value={formatDate(order.created)} />
          <DataRow label="Updated" value={formatDate(order.updated)} />
        </SectionCard>

        {/* Type details — containers or packages */}
        <TypeDetailsCard order={order} orderType={order.order_type} />

        {/* Parties */}
        <PartiesCard
          order={order}
          onOpenDiff={setDiffParty}
          accountType={accountType}
          onEdit={() => setShowEditParties(true)}
        />

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

        {/* Order Scope */}
        <ScopeFlagsCard
          shipmentId={order.quotation_id}
          scope={((order as unknown as Record<string, unknown>).scope as ScopeFlags | null) ?? null}
          accountType={accountType}
        />

        {/* Ground Transport Reconciliation */}
        <GroundTransportReconcileCard shipmentId={order.quotation_id} />

      </div>

      )}

      {/* Company reassignment modal */}
      {showCompanyModal && order.company_id && (
        <CompanyReassignModal
          shipmentId={order.quotation_id}
          currentCompanyId={order.company_id}
          onClose={() => setShowCompanyModal(false)}
          onReassigned={(companyId, companyName) => {
            setOrder(prev => prev ? { ...prev, company_id: companyId, _company_name: companyName } : prev);
          }}
        />
      )}

      {/* Document Parse modal */}
      {showDocParseModal && (
        <DocumentParseModal
          shipmentId={order.quotation_id}
          companyId={order.company_id}
          currentParties={{
            shipper: order.parties?.shipper ? {
              name: order.parties.shipper.name ?? undefined,
              address: order.parties.shipper.address ?? undefined,
            } : undefined,
            consignee: order.parties?.consignee ? {
              name: order.parties.consignee.name ?? undefined,
              address: order.parties.consignee.address ?? undefined,
            } : undefined,
          }}
          ports={ports}
          onClose={() => setShowDocParseModal(false)}
          allowedTypes={
            ['SEA_FCL', 'SEA_LCL'].includes(order.order_type)
              ? ['BL', 'BOOKING_CONFIRMATION']
              : order.order_type === 'AIR'
                ? ['AWB', 'BOOKING_CONFIRMATION']
                : ['BOOKING_CONFIRMATION']
          }
          onResult={createDocResultHandler({
            quotationId: order.quotation_id,
            companyId: order.company_id,
            order,
            loadOrder,
            loadRouteTimings,
            router,
            setShowDocParseModal,
            setFilesRefreshKey,
            setRouteTimelineRefreshKey,
          })}
        />
      )}

      {/* Edit Parties modal */}
      {showEditParties && (
        <EditPartiesModal
          order={order}
          onClose={() => setShowEditParties(false)}
          onSaved={() => {
            setShowEditParties(false);
            loadOrder();
          }}
        />
      )}

      {/* Transport edit modal */}
      {showTransportEdit && (
        <TransportEditModal
          order={order}
          shipmentId={order.quotation_id}
          onSaved={() => { setShowTransportEdit(false); loadOrder(); }}
          onClose={() => setShowTransportEdit(false)}
        />
      )}

      {/* BL Party Diff modal */}
      {diffParty && order.bl_document && (
        <BLPartyDiffModal
          party={diffParty}
          blValues={diffParty === 'shipper' ? order.bl_document.shipper ?? null : order.bl_document.consignee ?? null}
          orderValues={diffParty === 'shipper' ? order.parties?.shipper ?? null : order.parties?.consignee ?? null}
          shipmentId={order.quotation_id}
          onClose={() => setDiffParty(null)}
          onUpdated={() => {
            setDiffParty(null);
            loadOrder();
          }}
        />
      )}
    </div>
  );
}
