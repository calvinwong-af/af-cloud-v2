'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Ship, Package, MapPin, Calendar, Upload,
  Users, FileText, AlertTriangle, Loader2, Hash,
  Container, Weight, Activity, ChevronDown, ChevronRight, Pencil, X,
  ClipboardList, Clock,
} from 'lucide-react';
import { fetchShipmentOrderDetailAction, fetchStatusHistoryAction, fetchCompaniesForShipmentAction, reassignShipmentCompanyAction } from '@/app/actions/shipments';
import type { StatusHistoryEntry } from '@/app/actions/shipments';
import { updateShipmentStatusAction, updateInvoicedStatusAction, updatePartiesAction } from '@/app/actions/shipments-write';
import { getCurrentUserProfileAction } from '@/app/actions/users';
import { formatDate } from '@/lib/utils';
import type { ShipmentOrder, ShipmentOrderStatus } from '@/lib/types';
import ShipmentTasks from '@/components/shipments/ShipmentTasks';
import ShipmentFilesTab from '@/components/shipments/ShipmentFilesTab';
import BLUpdateModal from '@/components/shipments/BLUpdateModal';
import BLPartyDiffModal from '@/components/shipments/BLPartyDiffModal';
import RouteNodeTimeline from '@/components/shipments/RouteNodeTimeline';
import PortPair from '@/components/shared/PortPair';
import { getRouteNodesAction } from '@/app/actions/shipments-route';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLOR, ORDER_TYPE_LABELS, getStatusPathList } from '@/lib/types';

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

function SectionCard({ title, icon, children, action }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide flex-1">{title}</h2>
        {action}
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

function RouteCard({ order, accountType, etd, eta, vesselName, voyageNumber }: {
  order: ShipmentOrder;
  accountType: string | null;
  etd?: string | null;
  eta?: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
}) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[var(--text-muted)]">
          <MapPin className="w-4 h-4" />
        </span>
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Route</h2>
      </div>
      <PortPair
        origin={{
          port_un_code: order.origin?.port_un_code ?? null,
          port_name: order.origin?.label ?? null,
          country_code: order.origin?.country_code ?? null,
        }}
        destination={{
          port_un_code: order.destination?.port_un_code ?? null,
          port_name: order.destination?.label ?? null,
          country_code: order.destination?.country_code ?? null,
        }}
        viewContext={accountType === 'AFU' ? 'customer' : 'staff'}
        etd={etd}
        eta={eta}
        incoterm={order.incoterm_code}
        orderType={order.order_type}
        size="lg"
        vesselName={vesselName}
        voyageNumber={voyageNumber}
      />
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

// ─── Edit Parties modal ─────────────────────────────────────────────────────

function EditPartiesModal({
  order,
  onClose,
  onSaved,
}: {
  order: ShipmentOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const parties = order.parties;
  const [shipperName, setShipperName] = useState(parties?.shipper?.name ?? '');
  const [shipperAddress, setShipperAddress] = useState(parties?.shipper?.address ?? '');
  const [consigneeName, setConsigneeName] = useState(parties?.consignee?.name ?? '');
  const [consigneeAddress, setConsigneeAddress] = useState(parties?.consignee?.address ?? '');
  const [notifyPartyName, setNotifyPartyName] = useState(parties?.notify_party?.name ?? '');
  const [notifyPartyAddress, setNotifyPartyAddress] = useState(parties?.notify_party?.address ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls = 'w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]';

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await updatePartiesAction(order.quotation_id, {
        shipper_name: shipperName || null,
        shipper_address: shipperAddress || null,
        consignee_name: consigneeName || null,
        consignee_address: consigneeAddress || null,
        notify_party_name: notifyPartyName || null,
        notify_party_address: notifyPartyAddress || null,
      });
      if (!result.success) {
        setError(result.error);
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError('Failed to update parties');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">Edit Parties</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Shipper */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-2">Shipper</label>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Name</label>
                <input type="text" value={shipperName} onChange={e => setShipperName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Address</label>
                <textarea value={shipperAddress} onChange={e => setShipperAddress(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              </div>
            </div>
          </div>

          {/* Consignee */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-2">Consignee</label>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Name</label>
                <input type="text" value={consigneeName} onChange={e => setConsigneeName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Address</label>
                <textarea value={consigneeAddress} onChange={e => setConsigneeAddress(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              </div>
            </div>
          </div>

          {/* Notify Party */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-2">Notify Party</label>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Name</label>
                <input type="text" value={notifyPartyName} onChange={e => setNotifyPartyName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Address</label>
                <textarea value={notifyPartyAddress} onChange={e => setNotifyPartyAddress(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)] flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Parties card ───────────────────────────────────────────────────────────

function hasPartyDiff(
  blParty: { name: string | null; address: string | null } | null | undefined,
  orderParty: { name: string; address: string | null } | null | undefined,
): boolean {
  if (!blParty || !orderParty) return false;
  return (blParty.name ?? '') !== (orderParty.name ?? '') || (blParty.address ?? '') !== (orderParty.address ?? '');
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function PartiesCard({ order, onOpenDiff, accountType, onEdit }: {
  order: ShipmentOrder;
  onOpenDiff?: (party: 'shipper' | 'consignee') => void;
  accountType?: string | null;
  onEdit?: () => void;
}) {
  const parties = order.parties;
  const bl = order.bl_document;
  const hasParties = parties && (parties.shipper || parties.consignee || parties.notify_party);

  const shipperDiff = hasPartyDiff(bl?.shipper, parties?.shipper);
  const consigneeDiff = hasPartyDiff(bl?.consignee, parties?.consignee);

  const canEditParties = accountType === 'AFU' && order.status !== 5001 && order.status !== -1;

  return (
    <SectionCard
      title="Parties"
      icon={<Users className="w-4 h-4" />}
      action={canEditParties ? (
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
          title="Edit parties"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      ) : undefined}
    >
      {!hasParties
        ? <EmptyState message="Parties not yet assigned" />
        : (
          <div className="space-y-4">
            {parties.shipper && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="text-xs font-semibold text-[var(--text-muted)] uppercase">Shipper</div>
                  {shipperDiff && (
                    <button
                      onClick={() => onOpenDiff?.('shipper')}
                      className="text-amber-500 hover:text-amber-600 transition-colors"
                      title={`BL shows: ${truncate(bl?.shipper?.name, 40)}`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-sm text-[var(--text)]">{parties.shipper.name}</div>
                {parties.shipper.address && <div className="text-xs text-[var(--text-muted)] whitespace-pre-wrap">{parties.shipper.address}</div>}
              </div>
            )}
            {parties.consignee && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="text-xs font-semibold text-[var(--text-muted)] uppercase">Consignee</div>
                  {consigneeDiff && (
                    <button
                      onClick={() => onOpenDiff?.('consignee')}
                      className="text-amber-500 hover:text-amber-600 transition-colors"
                      title={`BL shows: ${truncate(bl?.consignee?.name, 40)}`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-sm text-[var(--text)]">{parties.consignee.name}</div>
                {parties.consignee.address && <div className="text-xs text-[var(--text-muted)] whitespace-pre-wrap">{parties.consignee.address}</div>}
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

// ─── Status card (v2.18 — redesigned) ─────────────────────────────────────────

/** Node labels — keyed by thousands digit */
const NODE_LABELS: Record<number, string> = {
  1: 'Pre-op',
  2: 'Confirmed',
  3: 'Booking',
  4: 'In Transit',
  5: 'Completed',
};

/** Sub-step labels for display below parent node */
const SUB_LABELS: Record<number, string> = {
  1001: 'Draft',
  1002: 'Pending Review',
  3001: 'Bkg Pending',
  3002: 'Bkg Confirmed',
  4001: 'Departed',
  4002: 'Arrived',
};

function StatusCard({ order, onReload, accountType }: { order: ShipmentOrder; onReload: () => void; accountType: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    status: ShipmentOrderStatus;
    label: string;
    allowJump?: boolean;
    revert?: boolean;
    undoneSteps?: string[];
  } | null>(null);
  const [subStepDialog, setSubStepDialog] = useState<{
    nodeLabel: string;
    steps: { status: ShipmentOrderStatus; label: string }[];
    selected: ShipmentOrderStatus;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<StatusHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [exceptionLoading, setExceptionLoading] = useState(false);
  const [exceptionNotes, setExceptionNotes] = useState('');
  const [showExceptionModal, setShowExceptionModal] = useState(false);

  const currentStatus = order.status;
  const isTerminal = currentStatus === 5001 || currentStatus === -1;
  const isAfu = accountType === 'AFU';

  // Determine path from incoterm + transaction_type
  const pathList = getStatusPathList(order.incoterm_code, order.transaction_type);

  // Find current position in path
  const currentIdx = pathList.indexOf(currentStatus);
  const displayIdx = currentIdx >= 0 ? currentIdx : 0;

  // Next step on path
  const nextStatus = displayIdx < pathList.length - 1 ? pathList[displayIdx + 1] : null;
  const advanceStatus = nextStatus && !isTerminal ? nextStatus : null;

  // Exception flag state
  const exceptionFlagged = order.exception?.flagged === true;

  // Can cancel from any non-terminal status
  const canCancel = !isTerminal;

  // Group steps by node (thousands digit)
  const nodes = (() => {
    const grouped: { node: number; label: string; steps: ShipmentOrderStatus[] }[] = [];
    let lastNode = -1;
    for (const step of pathList) {
      const node = step === -1 ? -1 : Math.floor(step / 1000);
      if (node !== lastNode) {
        grouped.push({ node, label: NODE_LABELS[node] ?? `${node}xxx`, steps: [step] });
        lastNode = node;
      } else {
        grouped[grouped.length - 1].steps.push(step);
      }
    }
    return grouped;
  })();

  // Determine node state: 'past' | 'current' | 'future'
  function getNodeState(nodeGroup: { steps: ShipmentOrderStatus[] }): 'past' | 'current' | 'future' {
    const hasCurrent = nodeGroup.steps.includes(currentStatus);
    // Terminal statuses (Completed, Cancelled) show as past/done, not current
    if (hasCurrent && (currentStatus === 5001 || currentStatus === -1)) return 'past';
    if (hasCurrent) return 'current';
    const firstIdx = pathList.indexOf(nodeGroup.steps[0]);
    return firstIdx < displayIdx ? 'past' : 'future';
  }

  async function executeStatusChange(newStatus: ShipmentOrderStatus, allowJump?: boolean, reverted?: boolean) {
    setError(null);
    setLoading(true);
    setConfirmAction(null);
    setSubStepDialog(null);
    try {
      const result = await updateShipmentStatusAction(order.quotation_id, newStatus, allowJump || undefined, reverted || undefined);
      if (!result) { setError('No response from server'); setLoading(false); return; }
      if (result.success) {
        setHistoryEntries([]);
        onReload();
      } else {
        setError(result.error);
      }
    } catch {
      setError('Failed to update status');
    }
    setLoading(false);
  }

  // Clicking a FUTURE node
  function handleFutureNodeClick(nodeGroup: { node: number; label: string; steps: ShipmentOrderStatus[] }) {
    if (loading || isTerminal) return;
    if (nodeGroup.steps.length === 1) {
      // Single-step node (Confirmed, Completed) → advance directly
      const target = nodeGroup.steps[0];
      if (target === 5001 || target === -1) {
        setConfirmAction({ status: target, label: SHIPMENT_STATUS_LABELS[target] ?? `${target}`, allowJump: true });
      } else {
        executeStatusChange(target, true);
      }
    } else {
      // Multi-step node (Booking, In Transit) → sub-step dialog
      setSubStepDialog({
        nodeLabel: nodeGroup.label,
        steps: nodeGroup.steps.map(s => ({ status: s, label: SHIPMENT_STATUS_LABELS[s] ?? `${s}` })),
        selected: nodeGroup.steps[0],
      });
    }
  }

  // Clicking a PAST node or sub-step
  function handlePastClick(targetStatus: ShipmentOrderStatus) {
    if (loading || !isAfu) return;
    const targetIdx = pathList.indexOf(targetStatus);
    const label = SHIPMENT_STATUS_LABELS[targetStatus] ?? `${targetStatus}`;
    const undoneSteps: string[] = [];
    for (let i = targetIdx + 1; i <= displayIdx; i++) {
      undoneSteps.push(SHIPMENT_STATUS_LABELS[pathList[i]] ?? `${pathList[i]}`);
    }
    setConfirmAction({ status: targetStatus, label, revert: true, undoneSteps });
  }

  function handleCancelClick() {
    setConfirmAction({ status: -1 as ShipmentOrderStatus, label: SHIPMENT_STATUS_LABELS[-1] ?? 'Cancelled' });
  }

  async function handleExceptionToggle() {
    if (exceptionFlagged) {
      setExceptionLoading(true);
      try {
        const { flagExceptionAction } = await import('@/app/actions/shipments-write');
        const result = await flagExceptionAction(order.quotation_id, false, null);
        if (!result) { setError('No response'); setExceptionLoading(false); return; }
        if (result.success) { onReload(); } else { setError(result.error); }
      } catch { setError('Failed to clear exception'); }
      setExceptionLoading(false);
    } else {
      setExceptionNotes('');
      setShowExceptionModal(true);
    }
  }

  async function handleExceptionConfirm() {
    setShowExceptionModal(false);
    setExceptionLoading(true);
    try {
      const { flagExceptionAction } = await import('@/app/actions/shipments-write');
      const result = await flagExceptionAction(order.quotation_id, true, exceptionNotes || null);
      if (!result) { setError('No response'); setExceptionLoading(false); return; }
      if (result.success) { onReload(); } else { setError(result.error); }
    } catch { setError('Failed to flag exception'); }
    setExceptionLoading(false);
  }

  async function handleInvoiceToggle() {
    setInvoiceLoading(true);
    try {
      const result = await updateInvoicedStatusAction(order.quotation_id, !order.issued_invoice);
      if (!result) { setError('No response'); setInvoiceLoading(false); return; }
      if (result.success) { onReload(); } else {
        setError(typeof result === 'object' && 'error' in result ? result.error : 'Failed to update');
      }
    } catch { setError('Failed to update invoice status'); }
    setInvoiceLoading(false);
  }

  async function toggleHistory() {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryOpen(true);
    if (historyEntries.length === 0) {
      setHistoryLoading(true);
      try {
        const entries = await fetchStatusHistoryAction(order.quotation_id);
        setHistoryEntries(entries ?? []);
      } catch { /* ignore */ }
      setHistoryLoading(false);
    }
  }

  const statusColor = SHIPMENT_STATUS_COLOR[currentStatus] ?? 'gray';
  const statusStyle = STATUS_STYLES[statusColor] ?? STATUS_STYLES.gray;
  const statusLabel = SHIPMENT_STATUS_LABELS[currentStatus] ?? `${currentStatus}`;

  return (
    <SectionCard title="Shipment Status" icon={<Activity className="w-4 h-4" />}>
      {/* Exception banner */}
      {exceptionFlagged && (
        <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-amber-800">Exception Flagged</span>
            {order.exception?.notes && (
              <span className="text-xs text-amber-700 ml-2">{order.exception.notes}</span>
            )}
          </div>
        </div>
      )}

      {/* Node-based Status Timeline — label-based, no numbers, no path label */}
      <div className="flex items-start justify-between overflow-x-auto pb-2 mb-4">
        {nodes.map((nodeGroup, ni) => {
          const state = getNodeState(nodeGroup);
          const isLastNode = ni === nodes.length - 1;
          const hasSubSteps = nodeGroup.steps.length > 1;

          // Are all sub-steps within this node complete?
          const currentSubsComplete = state === 'current' && (() => {
            const lastStep = nodeGroup.steps[nodeGroup.steps.length - 1];
            const lastIdx = pathList.indexOf(lastStep);
            return lastIdx <= displayIdx;
          })();

          // Current node: clickable if multi-step with incomplete sub-steps
          const currentIncomplete = state === 'current' && hasSubSteps && !currentSubsComplete;

          // Circle styles — 4 states
          const circleClass =
            state === 'past' ? 'bg-[var(--sky)] border-[var(--sky)] text-white' :
            state === 'current' ? 'bg-[var(--sky-pale)] border-[var(--sky)] text-[var(--sky)]' :
            'bg-white border-[var(--border)] text-gray-400';

          const circleBorder = state === 'current' ? 'border-[2.5px]' : 'border-2';

          // Cursor
          const nodeCursor =
            state === 'future' ? 'cursor-pointer' :
            state === 'past' && isAfu ? 'cursor-pointer' :
            currentIncomplete ? 'cursor-pointer' :
            'cursor-default';

          // Label styles
          const labelClass =
            state === 'current' ? 'text-[var(--sky)] font-semibold' :
            state === 'past' ? 'text-[var(--text-mid)]' :
            'text-[var(--text-muted)]';

          // Node click handler
          function handleNodeClick() {
            if (state === 'future') handleFutureNodeClick(nodeGroup);
            else if (state === 'past') {
              handlePastClick(nodeGroup.steps[nodeGroup.steps.length - 1]);
            } else if (currentIncomplete) {
              handleFutureNodeClick(nodeGroup);
            }
          }

          return (
            <div key={nodeGroup.node} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center w-full">
                {/* Main node circle + connector row */}
                <div className="flex items-center w-full">
                  {/* Left connector */}
                  {ni > 0 && (
                    <div className={`flex-1 h-0.5 ${
                      state === 'past' || state === 'current' ? 'bg-[var(--sky)]' : 'border-t border-dashed border-gray-300'
                    }`} />
                  )}
                  {ni === 0 && <div className="flex-1" />}

                  {/* Node circle */}
                  <div
                    onClick={handleNodeClick}
                    className={`w-7 h-7 rounded-full ${circleBorder} flex items-center justify-center flex-shrink-0 transition-colors ${circleClass} ${nodeCursor}`}
                  >
                    {state === 'past' && (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                    {state === 'current' && currentSubsComplete && (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                    {state === 'current' && !currentSubsComplete && (
                      <Clock size={14} />
                    )}
                  </div>

                  {/* Right connector */}
                  {!isLastNode && (
                    <div className={`flex-1 h-0.5 ${
                      state === 'past' ? 'bg-[var(--sky)]' : 'border-t border-dashed border-gray-300'
                    }`} />
                  )}
                  {isLastNode && <div className="flex-1" />}
                </div>

                {/* Counter badge — below circle, above label — only multi-step nodes */}
                {hasSubSteps && (() => {
                  const total = nodeGroup.steps.length;
                  const completed = nodeGroup.steps.filter(s => {
                    const idx = pathList.indexOf(s);
                    return idx <= displayIdx;
                  }).length;
                  const badgeClass =
                    state === 'past' ? 'bg-[var(--sky)] text-white border-transparent' :
                    state === 'current' ? 'bg-white text-[var(--sky)] border-[var(--sky)]' :
                    'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]';
                  return (
                    <span className={`mt-1 px-1.5 py-px rounded-full text-[9px] leading-none font-mono border ${badgeClass}`}>
                      {completed}/{total}
                    </span>
                  );
                })()}

                {/* Node label */}
                <span className={`text-[11px] ${hasSubSteps ? 'mt-0.5' : 'mt-1.5'} whitespace-nowrap text-center ${labelClass} ${nodeCursor}`} onClick={handleNodeClick}>
                  {nodeGroup.label}
                </span>

                {/* Current sub-step label — only on active multi-step node */}
                {hasSubSteps && state === 'current' && (() => {
                  const currentSub = SUB_LABELS[currentStatus] ?? SHIPMENT_STATUS_LABELS[currentStatus] ?? '';
                  return currentSub ? (
                    <span className="text-[10px] text-[var(--sky)]/70 whitespace-nowrap">
                      {currentSub}
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
          );
        })}
        {/* Cancelled indicator */}
        {currentStatus === -1 && (
          <div className="flex flex-col items-center flex-shrink-0 ml-2">
            <div className="w-7 h-7 rounded-full bg-red-500 border-2 border-red-500 flex items-center justify-center text-white">
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
            <span className="text-[11px] mt-1.5 whitespace-nowrap text-red-600 font-medium">Cancelled</span>
          </div>
        )}
      </div>

      {/* Current status + last updated */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs text-[var(--text-muted)] mr-2">Current status</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyle}`}>
            {statusLabel}
          </span>
        </div>
        {order.last_status_updated && (
          <span className="text-xs text-[var(--text-muted)]">
            Last updated {formatDate(order.last_status_updated)}
          </span>
        )}
      </div>

      {/* Action Buttons */}
      {isTerminal ? null : (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main advance button */}
          {advanceStatus && (
            <button
              onClick={() => {
                if (advanceStatus === 5001 || advanceStatus === -1) {
                  setConfirmAction({ status: advanceStatus, label: SHIPMENT_STATUS_LABELS[advanceStatus] ?? `${advanceStatus}` });
                } else {
                  executeStatusChange(advanceStatus);
                }
              }}
              disabled={loading}
              className="px-4 py-2 bg-[var(--sky)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Advance to {SHIPMENT_STATUS_LABELS[advanceStatus]}
            </button>
          )}

          {/* Exception flag/clear button */}
          <button
            onClick={handleExceptionToggle}
            disabled={exceptionLoading || loading}
            className={`px-4 py-2 border text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${
              exceptionFlagged
                ? 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100'
                : 'border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            {exceptionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {exceptionFlagged ? 'Clear Exception' : '\u2691 Flag Exception'}
          </button>

          {/* Cancel button */}
          {canCancel && (
            <button
              onClick={handleCancelClick}
              disabled={loading}
              className="px-4 py-2 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              &#x2715; Cancel Shipment
            </button>
          )}
        </div>
      )}

      {/* Inline error */}
      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Status change confirmation / revert modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            {confirmAction.revert ? (
              <>
                <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
                  Revert to {confirmAction.label}?
                </h3>
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  This will move the shipment backwards.
                </p>
                {confirmAction.undoneSteps && confirmAction.undoneSteps.length > 0 && (
                  <p className="text-xs text-[var(--text-muted)] mb-3">
                    Steps undone: {confirmAction.undoneSteps.join(', ')}
                  </p>
                )}
                <p className="text-xs text-[var(--text-muted)] mb-5">
                  This action will be recorded in the status history.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
                  Confirm: {confirmAction.label}
                </h3>
                <p className="text-sm text-[var(--text-muted)] mb-5">
                  Are you sure you want to set this shipment to <strong>{confirmAction.label}</strong>?
                  This action cannot be easily undone.
                </p>
              </>
            )}
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeStatusChange(confirmAction.status, confirmAction.allowJump, confirmAction.revert)}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90 ${
                  confirmAction.revert ? 'bg-amber-600' : confirmAction.status === -1 ? 'bg-red-600' : 'bg-[var(--sky)]'
                }`}
              >
                {confirmAction.revert ? 'Revert' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-step selection dialog */}
      {subStepDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
              Set {subStepDialog.nodeLabel} Status
            </h3>
            <div className="space-y-2 mb-5">
              {subStepDialog.steps.map(s => (
                <label key={s.status} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="substep"
                    checked={subStepDialog.selected === s.status}
                    onChange={() => setSubStepDialog({ ...subStepDialog, selected: s.status })}
                    className="w-4 h-4 accent-[var(--sky)]"
                  />
                  <span className="text-sm text-[var(--text)]">{s.label}</span>
                  <span className="text-xs text-[var(--text-muted)]">({s.status})</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setSubStepDialog(null)}
                className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeStatusChange(subStepDialog.selected, true)}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--sky)] rounded-lg transition-opacity hover:opacity-90"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exception flag modal */}
      {showExceptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Flag Exception</h3>
            <p className="text-sm text-[var(--text-muted)] mb-3">Add a note describing the exception (optional).</p>
            <textarea
              value={exceptionNotes}
              onChange={e => setExceptionNotes(e.target.value)}
              placeholder="e.g. Carrier delayed departure by 3 days"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent mb-4 resize-none"
              rows={3}
            />
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowExceptionModal(false)}
                className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExceptionConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg transition-opacity hover:opacity-90"
              >
                Flag Exception
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoiced Toggle */}
      <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between">
        <div>
          <span className="text-sm text-[var(--text)]">Invoiced</span>
          <span className="text-xs text-[var(--text-muted)] ml-2">
            {currentStatus === 5001
              ? (order.issued_invoice ? 'Invoice processed' : 'Awaiting invoice')
              : 'Available after shipment is completed'}
          </span>
        </div>
        <button
          onClick={currentStatus === 5001 ? handleInvoiceToggle : undefined}
          disabled={currentStatus !== 5001 || invoiceLoading}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            order.issued_invoice && currentStatus === 5001 ? 'bg-[var(--sky)]' : 'bg-gray-300'
          } ${currentStatus !== 5001 ? 'opacity-40 cursor-not-allowed' : ''} ${invoiceLoading ? 'opacity-50' : ''}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            order.issued_invoice ? 'translate-x-5' : ''
          }`} />
        </button>
      </div>

      {/* Status History */}
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <button
          onClick={toggleHistory}
          className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide hover:text-[var(--text)] transition-colors"
        >
          {historyOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Status History
        </button>
        {historyOpen && (
          <div className="mt-3 space-y-2">
            {historyLoading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-muted)]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading history…
              </div>
            ) : historyEntries.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic py-1">No status changes recorded yet.</p>
            ) : (
              [...historyEntries].reverse().map((entry, i) => {
                const entryColor = SHIPMENT_STATUS_COLOR[entry.status] ?? 'gray';
                const entryStyle = STATUS_STYLES[entryColor] ?? STATUS_STYLES.gray;
                const isReverted = 'reverted' in entry && !!(entry as Record<string, unknown>).reverted;
                const revertedFromLabel = isReverted && 'reverted_from' in entry
                  ? SHIPMENT_STATUS_LABELS[(entry as Record<string, unknown>).reverted_from as number] ?? ''
                  : '';
                return (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${entryStyle}`}>
                        {entry.status_label}
                      </span>
                      {isReverted && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                          reverted{revertedFromLabel ? ` from ${revertedFromLabel}` : ''}
                        </span>
                      )}
                      <span className="text-xs text-[var(--text-muted)]">{entry.changed_by}</span>
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">{formatDate(entry.timestamp)}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Company reassign modal ──────────────────────────────────────────────────

function CompanyReassignModal({ shipmentId, currentCompanyId, onClose, onReassigned }: {
  shipmentId: string;
  currentCompanyId: string;
  onClose: () => void;
  onReassigned: (companyId: string, companyName: string) => void;
}) {
  const [companies, setCompanies] = useState<{ company_id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCompaniesForShipmentAction().then((c) => {
      setCompanies(c);
      setLoadingList(false);
    });
  }, []);

  useEffect(() => {
    if (!loadingList) inputRef.current?.focus();
  }, [loadingList]);

  const filtered = search.trim()
    ? companies.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.company_id.toLowerCase().includes(search.toLowerCase())
      )
    : companies;

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const result = await reassignShipmentCompanyAction(shipmentId, selected);
    setSaving(false);
    if (result.success) {
      onReassigned(result.data.company_id, result.data.company_name);
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">Reassign Company</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies…"
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent mb-3"
          />

          <div className="max-h-56 overflow-y-auto border border-[var(--border)] rounded-lg">
            {loadingList ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-[var(--text-muted)]">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading companies…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-[var(--text-muted)]">No companies found</div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.company_id}
                  onClick={() => setSelected(c.company_id)}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-[var(--border)] last:border-0 transition-colors ${
                    selected === c.company_id
                      ? 'bg-[var(--sky-pale)] text-[var(--sky)]'
                      : c.company_id === currentCompanyId
                      ? 'bg-gray-50 text-[var(--text-muted)]'
                      : 'hover:bg-[var(--surface)] text-[var(--text)]'
                  }`}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-[var(--text-muted)] font-mono">{c.company_id}</div>
                </button>
              ))
            )}
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || selected === currentCompanyId || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
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
  const [accountType, setAccountType] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showBLModal, setShowBLModal] = useState(false);
  const [diffParty, setDiffParty] = useState<'shipper' | 'consignee' | null>(null);
  const [showEditParties, setShowEditParties] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'files'>('overview');
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
      const [, profile] = await Promise.all([
        loadOrder(),
        getCurrentUserProfileAction(),
        loadRouteTimings(),
      ]);
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
      />

      {/* BL Upload button — AFU, status >= 2001 (Confirmed+), sea shipments */}
      {accountType === 'AFU' && order.status >= 2001 && ['SEA_FCL', 'SEA_LCL'].includes(order.order_type) && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowBLModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--sky)] border border-[var(--sky)] rounded-lg hover:bg-[var(--sky-mist)] transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload BL
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
            userRole={userRole}
            vesselName={vesselName}
            voyageNumber={voyageNumber}
          />
        </div>
      ) : activeTab === 'files' ? (
        <ShipmentFilesTab
          shipmentId={order.quotation_id}
          userRole={accountType === 'AFU' ? 'AFU' : (userRole ?? 'AFC_USER')}
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
        <TypeDetailsCard order={order} />

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

      {/* BL Update modal */}
      {showBLModal && (
        <BLUpdateModal
          shipmentId={order.quotation_id}
          onClose={() => setShowBLModal(false)}
          onSuccess={() => {
            setShowBLModal(false);
            loadOrder();
          }}
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
