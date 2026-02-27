'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Ship, Plane, Package, MapPin, Calendar,
  Users, FileText, AlertTriangle, Loader2, Hash,
  Container, Weight, Activity, ChevronDown, ChevronRight, Pencil, X,
} from 'lucide-react';
import { fetchShipmentOrderDetailAction, fetchStatusHistoryAction, fetchCompaniesForShipmentAction, reassignShipmentCompanyAction } from '@/app/actions/shipments';
import type { StatusHistoryEntry } from '@/app/actions/shipments';
import { updateShipmentStatusAction, updateInvoicedStatusAction } from '@/app/actions/shipments-write';
import { getCurrentUserProfileAction } from '@/app/actions/users';
import { formatDate } from '@/lib/utils';
import type { ShipmentOrder, ShipmentOrderStatus } from '@/lib/types';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLOR, ORDER_TYPE_LABELS, VALID_TRANSITIONS } from '@/lib/types';

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

// ─── Status card ──────────────────────────────────────────────────────────────

/** Linear status flow (excludes Exception and Cancelled) */
const LINEAR_FLOW: ShipmentOrderStatus[] = [1001, 1002, 2001, 2002, 3001, 3002, 3003, 4001, 5001];

/** Explicit step label → status code mapping for reversion clicks.
 *  Never derive status codes from array index or position — always use this map. */
const STEP_STATUS_CODES: Record<string, number> = {
  'Draft': 1001,
  'Pending Review': 1002,
  'Confirmed': 2001,
  'Booking Pending': 2002,
  'Booking Confirmed': 3001,
  'In Transit': 3002,
  'Arrived': 3003,
  'Clearance In Progress': 4001,
  'Completed': 5001,
};

/** Two-line labels for the timeline stepper — long labels get a line break */
const TIMELINE_LABELS: Partial<Record<number, React.ReactNode>> = {
  1002: <>Pending{'\n'}Review</>,
  2002: <>Booking{'\n'}Pending</>,
  3001: <>Booking{'\n'}Confirmed</>,
  3002: <>In{'\n'}Transit</>,
  4001: <>Clearance{'\n'}In Progress</>,
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<StatusHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const currentStatus = order.status;
  const validNext = VALID_TRANSITIONS[currentStatus] ?? [];
  const isTerminal = currentStatus === 5001 || currentStatus === -1;
  const isAfu = accountType === 'AFU';

  // Find where current status sits in linear flow
  const currentLinearIdx = LINEAR_FLOW.indexOf(currentStatus);
  // For Exception/Cancelled, find the last known linear position from pre_exception or history
  const displayIdx = currentLinearIdx >= 0
    ? currentLinearIdx
    : (() => {
        // Search history in reverse for last linear status
        for (let i = (order.status_history ?? []).length - 1; i >= 0; i--) {
          const idx = LINEAR_FLOW.indexOf(order.status_history[i].status as ShipmentOrderStatus);
          if (idx >= 0) return idx;
        }
        return 0;
      })();

  // Determine the natural next linear step
  const nextLinearStatus = displayIdx < LINEAR_FLOW.length - 1
    ? LINEAR_FLOW[displayIdx + 1]
    : null;
  const advanceStatus = nextLinearStatus && validNext.includes(nextLinearStatus)
    ? nextLinearStatus
    : null;

  const canException = validNext.includes(4002);
  const canCancel = validNext.includes(-1);

  // Invoiced toggle: only enabled when completed
  const invoiceEnabled = currentStatus === 5001;

  async function executeStatusChange(newStatus: ShipmentOrderStatus, allowJump?: boolean, reverted?: boolean) {
    setError(null);
    setLoading(true);
    setConfirmAction(null);
    const result = await updateShipmentStatusAction(order.quotation_id, newStatus, allowJump || undefined, reverted || undefined);
    setLoading(false);
    if (result.success) {
      // Clear cached history so it refetches on next open
      setHistoryEntries([]);
      onReload();
    } else {
      setError(result.error);
    }
  }

  function handleAdvanceClick(newStatus: ShipmentOrderStatus) {
    // Advance button: no allow_jump, uses VALID_TRANSITIONS
    if (newStatus === 5001 || newStatus === -1) {
      setConfirmAction({ status: newStatus, label: SHIPMENT_STATUS_LABELS[newStatus] ?? `${newStatus}` });
    } else {
      executeStatusChange(newStatus);
    }
  }

  function handleTimelineDotClick(targetStatus: ShipmentOrderStatus) {
    if (loading || isTerminal) return;
    // Dot clicks always use allow_jump: true
    if (targetStatus === 5001) {
      setConfirmAction({ status: targetStatus, label: SHIPMENT_STATUS_LABELS[targetStatus] ?? `${targetStatus}`, allowJump: true });
    } else {
      executeStatusChange(targetStatus, true);
    }
  }

  function handleRevertClick(stepLabel: string, stepIdx: number) {
    if (loading || !isAfu) return;
    console.log('[revert click] raw stepLabel:', JSON.stringify(stepLabel));
    const cleanLabel = stepLabel.trim();
    const statusCode = STEP_STATUS_CODES[cleanLabel];
    if (statusCode === undefined) {
      console.warn('[revert] no status code found for step:', JSON.stringify(stepLabel));
      return;
    }
    console.log('[revert click] stepLabel:', cleanLabel, 'stepIndex:', stepIdx, 'statusCode being sent:', statusCode, 'currentStatus:', currentStatus);
    // Collect the names of steps that will be undone (from target+1 through current)
    const undoneSteps: string[] = [];
    for (let i = stepIdx + 1; i <= displayIdx; i++) {
      undoneSteps.push(SHIPMENT_STATUS_LABELS[LINEAR_FLOW[i]] ?? `${LINEAR_FLOW[i]}`);
    }
    setConfirmAction({
      status: statusCode as ShipmentOrderStatus,
      label: cleanLabel,
      revert: true,
      undoneSteps,
    });
  }

  function handleExceptionClick() {
    executeStatusChange(4002 as ShipmentOrderStatus);
  }

  function handleCancelClick() {
    setConfirmAction({ status: -1 as ShipmentOrderStatus, label: SHIPMENT_STATUS_LABELS[-1] ?? 'Cancelled' });
  }

  async function handleInvoiceToggle() {
    setInvoiceLoading(true);
    const result = await updateInvoicedStatusAction(order.quotation_id, !order.issued_invoice);
    setInvoiceLoading(false);
    if (result.success) {
      onReload();
    } else {
      setError(typeof result === 'object' && 'error' in result ? result.error : 'Failed to update');
    }
  }

  async function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (historyEntries.length === 0) {
      setHistoryLoading(true);
      const entries = await fetchStatusHistoryAction(order.quotation_id);
      setHistoryEntries(entries);
      setHistoryLoading(false);
    }
  }

  const statusColor = SHIPMENT_STATUS_COLOR[currentStatus] ?? 'gray';
  const statusStyle = STATUS_STYLES[statusColor] ?? STATUS_STYLES.gray;
  const statusLabel = SHIPMENT_STATUS_LABELS[currentStatus] ?? `${currentStatus}`;

  return (
    <SectionCard title="Shipment Status" icon={<Activity className="w-4 h-4" />}>
      {/* Status Timeline */}
      <div className="flex items-center gap-0 overflow-x-auto pb-3 mb-4">
        {LINEAR_FLOW.map((step, i) => {
          const isFilled = i <= displayIdx;
          const isCurrent = i === displayIdx;
          const isFuture = i > displayIdx && !isTerminal;
          // Completed predecessor steps are clickable for AFU users (reversion)
          const isRevertable = isFilled && !isCurrent && isAfu && !loading;
          const label = SHIPMENT_STATUS_LABELS[step] ?? `${step}`;
          const isLast = i === LINEAR_FLOW.length - 1;
          return (
            <div key={step} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center group relative">
                <div
                  className={`w-3 h-3 rounded-full border-2 transition-colors ${
                    isFilled
                      ? 'bg-[var(--sky)] border-[var(--sky)]'
                      : 'bg-white border-gray-300'
                  } ${isFuture ? 'cursor-pointer hover:border-[var(--sky)] hover:bg-sky-100' : ''} ${isRevertable ? 'cursor-pointer hover:bg-amber-400 hover:border-amber-400' : ''}`}
                  onClick={isFuture ? () => handleTimelineDotClick(step) : isRevertable ? () => handleRevertClick(label, i) : undefined}
                />
                <span className={`text-[10px] mt-1 whitespace-pre-line text-center leading-tight ${
                  isFilled ? 'text-[var(--text)] font-medium' : 'text-gray-400'
                } ${isFuture || isRevertable ? 'cursor-pointer' : ''}`}
                  onClick={isFuture ? () => handleTimelineDotClick(step) : isRevertable ? () => handleRevertClick(label, i) : undefined}
                >
                  {TIMELINE_LABELS[step] ?? label}
                </span>
                {/* Tooltip for future steps */}
                {isFuture && (
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 px-2 py-1 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap">
                    Jump to {label}
                  </div>
                )}
                {/* Tooltip for revertable steps */}
                {isRevertable && (
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 px-2 py-1 bg-amber-700 text-white text-[10px] rounded whitespace-nowrap">
                    Revert to {label}
                  </div>
                )}
              </div>
              {!isLast && (
                <div className={`h-0.5 w-6 mx-0.5 mt-[-10px] ${
                  i < displayIdx ? 'bg-[var(--sky)]' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
        {/* Exception / Cancelled indicator */}
        {(currentStatus === 4002 || currentStatus === -1) && (
          <div className="flex items-center flex-shrink-0 ml-2">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-500" />
              <span className="text-[10px] mt-1 whitespace-nowrap text-red-600 font-medium">
                {statusLabel}
              </span>
            </div>
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
              onClick={() => handleAdvanceClick(advanceStatus)}
              disabled={loading}
              className="px-4 py-2 bg-[var(--sky)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Advance to {SHIPMENT_STATUS_LABELS[advanceStatus]}
            </button>
          )}

          {/* Exception button */}
          {canException && (
            <button
              onClick={handleExceptionClick}
              disabled={loading}
              className="px-4 py-2 border border-amber-400 text-amber-700 bg-amber-50 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              &#x2691; Flag Exception
            </button>
          )}

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

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            {confirmAction.revert ? (
              <>
                <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
                  Revert to {confirmAction.label}?
                </h3>
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  This will undo {confirmAction.undoneSteps?.join(', ')}.
                </p>
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

      {/* Invoiced Toggle */}
      <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between">
        <div>
          <span className="text-sm text-[var(--text)]">Invoiced</span>
          <span className="text-xs text-[var(--text-muted)] ml-2">
            {invoiceEnabled
              ? (order.issued_invoice ? 'Invoice processed' : 'Awaiting invoice')
              : 'Available after shipment is completed'}
          </span>
        </div>
        <button
          onClick={invoiceEnabled ? handleInvoiceToggle : undefined}
          disabled={!invoiceEnabled || invoiceLoading}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            order.issued_invoice && invoiceEnabled ? 'bg-[var(--sky)]' : 'bg-gray-300'
          } ${!invoiceEnabled ? 'opacity-40 cursor-not-allowed' : ''} ${invoiceLoading ? 'opacity-50' : ''}`}
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
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  const loadOrder = useCallback(async () => {
    const result = await fetchShipmentOrderDetailAction(quotationId);
    if (result.success) {
      setOrder(result.data);
    } else {
      setError(result.error);
    }
  }, [quotationId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [, profile] = await Promise.all([
        loadOrder(),
        getCurrentUserProfileAction(),
      ]);
      setAccountType(profile.account_type);
      setLoading(false);
    }
    load();
  }, [loadOrder]);

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
      <RouteCard order={order} />

      {/* Status Management */}
      <StatusCard order={order} onReload={loadOrder} accountType={accountType} />

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
    </div>
  );
}
