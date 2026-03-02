'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Ship, Package, Calendar, Upload,
  FileText, AlertTriangle, Loader2, Hash,
  ClipboardList, Pencil,
} from 'lucide-react';
import { fetchShipmentOrderDetailAction, fetchPortsAction } from '@/app/actions/shipments';
import { getCurrentUserProfileAction } from '@/app/actions/users';
import { formatDate } from '@/lib/utils';
import type { ShipmentOrder } from '@/lib/types';
import type { Port } from '@/lib/ports';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLOR, ORDER_TYPE_LABELS } from '@/lib/types';
import ShipmentTasks from '@/components/shipments/ShipmentTasks';
import ShipmentFilesTab from '@/components/shipments/ShipmentFilesTab';
import BLUpdateModal from '@/components/shipments/BLUpdateModal';
import type { ParsedBL } from '@/components/shipments/BLUpdateModal';
import BLPartyDiffModal from '@/components/shipments/BLPartyDiffModal';
import DocumentParseModal from '@/components/shipments/DocumentParseModal';
import RouteNodeTimeline from '@/components/shipments/RouteNodeTimeline';
import { getRouteNodesAction } from '@/app/actions/shipments-route';
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
} from './_components';
import { createDocResultHandler } from './_doc-handler';

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
  const [showBLModal, setShowBLModal] = useState(false);
  const [showDocParseModal, setShowDocParseModal] = useState(false);
  const [docParseBLData, setDocParseBLData] = useState<ParsedBL | null>(null);
  const [ports, setPorts] = useState<{ un_code: string; name: string; country: string; port_type: string; has_terminals: boolean; terminals: Array<{ terminal_id: string; name: string; is_default: boolean }> }[]>([]);
  const [diffParty, setDiffParty] = useState<'shipper' | 'consignee' | null>(null);
  const [showEditParties, setShowEditParties] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'files'>('overview');
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);
  const [routeEtd, setRouteEtd] = useState<string | null>(null);
  const [routeEta, setRouteEta] = useState<string | null>(null);

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
      const result = await getRouteNodesAction(quotationId);
      if (result.success && result.data) {
        const origin = result.data.find(n => n.role === 'ORIGIN');
        const dest = result.data.find(n => n.role === 'DESTINATION');
        setRouteEtd(origin?.actual_etd ?? origin?.scheduled_etd ?? null);
        setRouteEta(dest?.actual_eta ?? dest?.scheduled_eta ?? null);
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
        etd={routeEtd}
        eta={routeEta}
        vesselName={vesselName}
        voyageNumber={voyageNumber}
        ports={ports as Port[]}
      />

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
      {activeTab === 'tasks' ? (
        <div className="space-y-4">
          <RouteNodeTimeline
            shipmentId={order.quotation_id}
            accountType={accountType}
            userRole={userRole}
          />
          <ShipmentTasks
            shipmentId={order.quotation_id}
            orderType={order.order_type}
            accountType={accountType}
            vesselName={vesselName}
            voyageNumber={voyageNumber}
          />
        </div>
      ) : activeTab === 'files' ? (
        <ShipmentFilesTab
          shipmentId={order.quotation_id}
          userRole={accountType === 'AFU' ? 'AFU' : (userRole ?? 'AFC_USER')}
          ports={ports}
          refreshKey={filesRefreshKey}
          onBLUpdated={loadOrder}
          onFileCountChange={setFileCount}
        />
      ) : (

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
        {(() => {
          const bookingRef = bk.booking_reference as string || null;
          const carrierAgent = bk.carrier_agent as string || null;
          const etd = (order as unknown as Record<string, unknown>).etd as string || null;
          if (!vesselName && !voyageNumber && !bookingRef && !carrierAgent && !etd) return null;
          return (
            <SectionCard title="Transport" icon={<Ship className="w-4 h-4" />}>
              <DataRow label="Vessel" value={vesselName} />
              <DataRow label="Voyage" value={voyageNumber} />
              <DataRow label="Booking Ref" value={bookingRef} mono />
              <DataRow label="Carrier / Agent" value={carrierAgent} />
              <DataRow label="ETD" value={etd ? formatDate(etd) : null} />
            </SectionCard>
          );
        })()}

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
            shipper: order.parties?.shipper ?? undefined,
            consignee: order.parties?.consignee ?? undefined,
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
            setDocParseBLData,
            setShowBLModal,
            setFilesRefreshKey,
          })}
        />
      )}

      {/* BL Update modal */}
      {showBLModal && (
        <BLUpdateModal
          shipmentId={order.quotation_id}
          ports={ports}
          onClose={() => { setShowBLModal(false); setDocParseBLData(null); }}
          onSuccess={() => {
            setShowBLModal(false);
            setDocParseBLData(null);
            loadOrder();
            loadRouteTimings();
          }}
          initialParsed={docParseBLData}
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
