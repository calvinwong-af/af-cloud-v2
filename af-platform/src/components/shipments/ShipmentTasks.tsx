'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, Circle, Lock, Loader2, Eye, EyeOff,
  Pencil, X, Clock, AlertTriangle, Undo2, Ship,
} from 'lucide-react';
import { fetchShipmentTasksAction, updateShipmentTaskAction } from '@/app/actions/shipments-write';
import type { WorkflowTask } from '@/app/actions/shipments-write';
import { DateTimeInput } from '@/components/shared/DateInput';

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

/** Format ISO timestamp as "28 Feb 2026, 10:30" */
function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  }) + ', ' + d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

/** Convert ISO timestamp to datetime-local input value (YYYY-MM-DDTHH:mm) */
function isoToLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert datetime-local input value to UTC ISO string */
function localDatetimeToISO(value: string): string {
  if (!value) return '';
  return new Date(value).toISOString();
}

interface ShipmentTasksProps {
  shipmentId: string;
  orderType?: string;
  accountType: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base fallback label map — used for all order types */
const TASK_LABELS: Record<string, string> = {
  ORIGIN_HAULAGE: 'Origin Haulage / Pickup',
  FREIGHT_BOOKING: 'Freight Booking',
  EXPORT_CLEARANCE: 'Export Customs Clearance',
  POL: 'Port of Loading',
  POD: 'Port of Discharge',
  IMPORT_CLEARANCE: 'Import Customs Clearance',
  DESTINATION_HAULAGE: 'Destination Haulage / Delivery',
};

/**
 * For loose cargo (AIR, SEA_LCL) the first/last mile is pickup/delivery,
 * not haulage. Haulage implies heavy equipment for containers (FCL).
 */
const LOOSE_CARGO_LABEL_OVERRIDES: Record<string, string> = {
  ORIGIN_HAULAGE: 'Origin Pickup',
  DESTINATION_HAULAGE: 'Destination Delivery',
};

const LOOSE_CARGO_TYPES = new Set(['AIR', 'SEA_LCL']);

/** Stale display_name values from old data model — must be replaced */
const STALE_LABELS = new Set([
  'Origin Haulage', 'Destination Ground Transportation', 'Vessel Departure', 'Vessel Arrival',
]);

function getTaskLabel(task: WorkflowTask, orderType?: string): string {
  const stored = task.display_name;
  // If stored name is valid (not stale), use it — unless it's a haulage
  // label on a loose-cargo shipment, in which case override it.
  if (stored && !STALE_LABELS.has(stored)) {
    if (orderType && LOOSE_CARGO_TYPES.has(orderType)) {
      const override = LOOSE_CARGO_LABEL_OVERRIDES[task.task_type];
      if (override) return override;
    }
    return stored;
  }
  // Fallback: use label map, with loose-cargo override if applicable
  if (orderType && LOOSE_CARGO_TYPES.has(orderType)) {
    const override = LOOSE_CARGO_LABEL_OVERRIDES[task.task_type];
    if (override) return override;
  }
  return TASK_LABELS[task.task_type] || task.task_type;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING:     { bg: 'bg-gray-100',   text: 'text-gray-700' },
  IN_PROGRESS: { bg: 'bg-blue-100',   text: 'text-blue-700' },
  COMPLETED:   { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  BLOCKED:     { bg: 'bg-amber-100',  text: 'text-amber-700' },
};

const MODE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ASSIGNED: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  TRACKED:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  IGNORED:  { bg: 'bg-gray-50',    text: 'text-gray-400',    border: 'border-gray-200' },
};

const ASSIGNED_LABELS: Record<string, string> = {
  AF: 'AcceleFreight',
  CUSTOMER: 'Customer',
  THIRD_PARTY: 'Third Party',
};

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Freight-specific timing labels for TRACKED tasks
// ---------------------------------------------------------------------------

function getTimingLabels(task: WorkflowTask): {
  scheduledStartLabel: string;
  scheduledEndLabel: string;
  startedLabel: string;
  completedLabel: string;
} {
  if (task.mode === 'TRACKED') {
    // Standardised across all TRACKED port tasks (POL, POD, transhipments)
    return { scheduledStartLabel: 'ETA', scheduledEndLabel: 'ETD', startedLabel: 'ATA', completedLabel: 'ATD' };
  }
  return { scheduledStartLabel: 'Sched. Start', scheduledEndLabel: 'Sched. End', startedLabel: 'Started', completedLabel: 'Completed' };
}

function canEdit(accountType: string | null): boolean {
  return accountType === 'AFU';
}

function canToggleVisibility(accountType: string | null): boolean {
  return accountType === 'AFU';
}

function canChangeMode(accountType: string | null): boolean {
  return accountType === 'AFU';
}

// ---------------------------------------------------------------------------
// Task card sub-component
// ---------------------------------------------------------------------------

function TaskCard({
  task,
  orderType,
  accountType,
  onMarkComplete,
  onUndo,
  onEdit,
  onToggleVisibility,
  saving,
  vesselName,
  voyageNumber,
}: {
  task: WorkflowTask;
  orderType?: string;
  accountType: string | null;
  onMarkComplete: (taskId: string) => void;
  onUndo: (taskId: string) => void;
  onEdit: (task: WorkflowTask) => void;
  onToggleVisibility: (taskId: string, visible: boolean) => void;
  saving: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
}) {
  const style = STATUS_STYLES[task.status] ?? STATUS_STYLES.PENDING;
  const modeStyle = MODE_STYLES[task.mode] ?? MODE_STYLES.ASSIGNED;
  const isHidden = task.visibility === 'HIDDEN';
  const isIgnored = task.mode === 'IGNORED';
  const isSaving = saving === task.task_id;
  const editable = canEdit(accountType);
  const showComplete = editable && !isIgnored && (task.status === 'PENDING' || task.status === 'IN_PROGRESS');
  const showUndo = editable && task.status === 'COMPLETED';
  const label = getTaskLabel(task, orderType);
  const timingLabels = getTimingLabels(task);

  return (
    <div
      className={`bg-white border border-[var(--border)] rounded-xl p-4 transition-opacity ${
        isIgnored ? 'opacity-50' : ''
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Status icon */}
          {task.status === 'COMPLETED' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          ) : task.status === 'BLOCKED' ? (
            <Lock className="w-5 h-5 text-amber-500 flex-shrink-0" />
          ) : task.status === 'IN_PROGRESS' ? (
            <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-[var(--text-muted)]">Leg {task.leg_level}</span>
              <span className={`text-sm font-semibold ${isIgnored ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text)]'}`}>
                {label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.bg} ${style.text}`}>
                {task.status.replace('_', ' ')}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${modeStyle.bg} ${modeStyle.text} ${modeStyle.border}`}>
                {task.mode}
              </span>
              {task.status === 'BLOCKED' && (
                <span className="text-[10px] text-amber-600">awaiting booking ref</span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {canToggleVisibility(accountType) && (
            <button
              onClick={() => onToggleVisibility(task.task_id, isHidden)}
              className={`p-1.5 rounded-lg transition-colors ${
                isHidden
                  ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                  : 'text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)]'
              }`}
              title={isHidden ? 'Show to customer' : 'Hide from customer'}
            >
              {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
          {editable && (
            <button
              onClick={() => onEdit(task)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
              title="Edit task"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Details row — not shown when IGNORED */}
      {!isIgnored && (
        <>
          <div className="mt-3 text-xs space-y-2">
            {/* Assigned to */}
            <div>
              <span className="text-[var(--text-muted)]">Assigned to</span>
              <div className="text-[var(--text-mid)] font-medium">
                {task.assigned_to === 'THIRD_PARTY' && task.third_party_name
                  ? task.third_party_name
                  : ASSIGNED_LABELS[task.assigned_to] ?? task.assigned_to}
              </div>
            </div>
            {/* Estimated row */}
            <div className="grid grid-cols-2 gap-x-4">
              <div>
                <span className="text-[var(--text-muted)]">{timingLabels.scheduledStartLabel}</span>
                <div className="text-[var(--text-mid)] font-medium">
                  {task.scheduled_start ? formatDateTime(task.scheduled_start) : '—'}
                </div>
              </div>
              {/* ETD only shown on POL and non-TRACKED tasks — not on POD */}
              {!(task.mode === 'TRACKED' && task.task_type === 'POD') && (
                <div>
                  <span className="text-[var(--text-muted)]">{timingLabels.scheduledEndLabel}</span>
                  <div className="text-[var(--text-mid)] font-medium">
                    {task.scheduled_end ? formatDateTime(task.scheduled_end) : task.due_date ? formatDateTime(task.due_date) : '—'}
                  </div>
                </div>
              )}
            </div>
            {/* Actual row — only shown if task has started */}
            {task.status !== 'PENDING' && (
              <div className="grid grid-cols-2 gap-x-4">
                <div>
                  <span className="text-[var(--text-muted)]">{timingLabels.startedLabel}</span>
                  <div className="text-blue-600 font-medium">
                    {task.actual_start ? formatDateTime(task.actual_start) : '—'}
                  </div>
                </div>
                {/* ATD hidden for TRACKED POD — ATA is the meaningful completion event */}
                {task.status === 'COMPLETED' && !(task.mode === 'TRACKED' && task.task_type === 'POD') && (
                  <div>
                    <span className="text-[var(--text-muted)]">{timingLabels.completedLabel}</span>
                    <div className="text-emerald-600 font-medium">
                      {task.actual_end ? formatDateTime(task.actual_end) : '—'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Deviation indicator */}
          {task.actual_end && task.scheduled_end && task.actual_end > task.scheduled_end && (
            <div className="mt-1.5 text-[10px] text-red-500 font-medium">
              Completed after scheduled end
            </div>
          )}
        </>
      )}

      {/* Notes */}
      {task.notes && !isIgnored && (
        <div className="mt-2 text-xs text-[var(--text-mid)] bg-[var(--surface)] rounded-lg px-3 py-2 border border-[var(--border)]">
          {task.notes}
        </div>
      )}

      {/* Vessel info — TRACKED POL only */}
      {!isIgnored && task.mode === 'TRACKED' && task.task_type === 'POL' && (vesselName || voyageNumber) && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <Ship className="w-3 h-3" />
          {vesselName && <span className="font-medium">{vesselName}</span>}
          {vesselName && voyageNumber && <span>·</span>}
          {voyageNumber && <span className="font-mono">{voyageNumber}</span>}
        </div>
      )}

      {/* Mark Complete button */}
      {showComplete && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <button
            onClick={() => onMarkComplete(task.task_id)}
            disabled={isSaving || task.status === 'BLOCKED'}
            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            Mark Complete
          </button>
        </div>
      )}

      {/* Undo Complete button */}
      {showUndo && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <button
            onClick={() => onUndo(task.task_id)}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Undo2 className="w-3 h-3" />
            )}
            Undo Complete
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit modal
// ---------------------------------------------------------------------------

function EditTaskModal({
  task,
  accountType,
  onSave,
  onClose,
  saving,
}: {
  task: WorkflowTask;
  accountType: string | null;
  onSave: (taskId: string, updates: Record<string, unknown>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [status, setStatus] = useState(task.status);
  const [mode, setMode] = useState(task.mode || 'ASSIGNED');
  const [assignedTo, setAssignedTo] = useState(task.assigned_to);
  const [thirdPartyName, setThirdPartyName] = useState(task.third_party_name ?? '');
  const [scheduledStart, setScheduledStart] = useState(task.scheduled_start ?? '');
  const [scheduledEnd, setScheduledEnd] = useState(task.scheduled_end ?? task.due_date ?? '');
  const [actualStart, setActualStart] = useState(isoToLocalDatetime(task.actual_start));
  const [actualEnd, setActualEnd] = useState(isoToLocalDatetime(task.actual_end));
  const [notes, setNotes] = useState(task.notes ?? '');

  const showModeSelector = canChangeMode(accountType);

  // When TRACKED mode, remove BLOCKED from status options
  const statusOptions = mode === 'TRACKED'
    ? [{ v: 'PENDING', l: 'Pending' }, { v: 'IN_PROGRESS', l: 'In Progress' }, { v: 'COMPLETED', l: 'Completed' }]
    : [{ v: 'PENDING', l: 'Pending' }, { v: 'IN_PROGRESS', l: 'In Progress' }, { v: 'COMPLETED', l: 'Completed' }, { v: 'BLOCKED', l: 'Blocked' }];

  function handleSave() {
    const updates: Record<string, unknown> = {};

    if (mode !== (task.mode || 'ASSIGNED')) updates.mode = mode;
    if (status !== task.status) updates.status = status;
    if (assignedTo !== task.assigned_to) updates.assigned_to = assignedTo;
    if (assignedTo === 'THIRD_PARTY' && thirdPartyName !== (task.third_party_name ?? '')) {
      updates.third_party_name = thirdPartyName || null;
    }
    if (scheduledStart !== (task.scheduled_start ?? '')) {
      updates.scheduled_start = scheduledStart || null;
    }
    if (scheduledEnd !== (task.scheduled_end ?? task.due_date ?? '')) {
      updates.scheduled_end = scheduledEnd || null;
      updates.due_date = scheduledEnd || null;
      updates.due_date_override = true;
    }
    const origActualStart = isoToLocalDatetime(task.actual_start);
    if (actualStart !== origActualStart) {
      updates.actual_start = actualStart ? localDatetimeToISO(actualStart) : null;
    }
    const origActualEnd = isoToLocalDatetime(task.actual_end);
    if (actualEnd !== origActualEnd) {
      updates.actual_end = actualEnd ? localDatetimeToISO(actualEnd) : null;
    }
    if (notes !== (task.notes ?? '')) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }
    onSave(task.task_id, updates);
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Edit {getTaskLabel(task)}
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Mode selector */}
          {showModeSelector && (
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] block mb-1.5">Mode</label>
              <div className="flex gap-1">
                {(['ASSIGNED', 'TRACKED', 'IGNORED'] as const).map((m) => {
                  const ms = MODE_STYLES[m];
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        active
                          ? `${ms.bg} ${ms.text} ${ms.border}`
                          : 'bg-white text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      {m.charAt(0) + m.slice(1).toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputCls}
            >
              {statusOptions.map(o => (
                <option key={o.v} value={o.v}>{o.l}</option>
              ))}
            </select>
          </div>

          {/* Assigned to */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Assigned to</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={inputCls}
            >
              <option value="AF">AcceleFreight</option>
              <option value="CUSTOMER">Customer</option>
              <option value="THIRD_PARTY">Third Party</option>
            </select>
          </div>

          {/* Third party name */}
          {assignedTo === 'THIRD_PARTY' && (
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Third Party Name</label>
              <input
                type="text"
                value={thirdPartyName}
                onChange={(e) => setThirdPartyName(e.target.value)}
                placeholder="e.g. DHL, Kuehne+Nagel"
                className={`${inputCls} placeholder:text-[var(--text-muted)]`}
              />
            </div>
          )}

          {/* Timing — Scheduled */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Scheduled</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-[var(--text-muted)]">Start</span>
                <DateTimeInput value={scheduledStart} onChange={setScheduledStart} className={inputCls} />
              </div>
              {/* ETD hidden for TRACKED POD — not relevant */}
              {!(task.mode === 'TRACKED' && task.task_type === 'POD') && (
                <div>
                  <span className="text-[10px] text-[var(--text-muted)]">End / Due</span>
                  <DateTimeInput value={scheduledEnd} onChange={setScheduledEnd} className={inputCls} />
                </div>
              )}
            </div>
          </div>

          {/* Timing — Actual */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Actual</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-[var(--text-muted)]">Start</span>
                <DateTimeInput value={actualStart} onChange={setActualStart} className={inputCls} />
              </div>
              {/* ATD hidden for TRACKED POD — ATA is the completion event */}
              {!(task.mode === 'TRACKED' && task.task_type === 'POD') && (
                <div>
                  <span className="text-[10px] text-[var(--text-muted)]">End</span>
                  <DateTimeInput value={actualEnd} onChange={setActualEnd} className={inputCls} />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes…"
              className={`${inputCls} resize-none placeholder:text-[var(--text-muted)]`}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)] flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ShipmentTasks({ shipmentId, orderType, accountType, vesselName, voyageNumber }: ShipmentTasksProps) {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<WorkflowTask | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchShipmentTasksAction(shipmentId);
      if (!result) {
        setError('Failed to load tasks — no response from server');
        setLoading(false);
        return;
      }
      if (result.success) {
        setTasks(result.data ?? []);
      } else {
        setError(result.error ?? 'Failed to load tasks');
      }
    } catch (err) {
      console.error('[ShipmentTasks] loadTasks failed:', err);
      setError('Failed to load tasks');
    }
    setLoading(false);
  }, [shipmentId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Dismiss warning after 5 seconds
  useEffect(() => {
    if (!warning) return;
    const timer = setTimeout(() => setWarning(null), 5000);
    return () => clearTimeout(timer);
  }, [warning]);

  async function handleMarkComplete(taskId: string) {
    setSaving(taskId);
    const now = new Date().toISOString();
    const matchedTask = tasks.find((t) => t.task_id === taskId);
    const isTrackedPOD = matchedTask?.mode === 'TRACKED' && matchedTask?.task_type === 'POD';

    // Optimistic update — TRACKED POD: ATA (actual_start) is the completion event
    setTasks((prev) =>
      prev.map((t) =>
        t.task_id === taskId
          ? isTrackedPOD
            ? { ...t, status: 'COMPLETED', completed_at: now, actual_start: now }
            : { ...t, status: 'COMPLETED', completed_at: now, actual_end: now }
          : t
      )
    );

    try {
      const result = await updateShipmentTaskAction(shipmentId, taskId, { status: 'COMPLETED' });
      setSaving(null);

      if (!result || !result.success) {
        await loadTasks();
        setError(result?.error ?? 'Failed to mark task complete');
        return;
      }

      if (result.warning) {
        setWarning(result.warning);
      }
      await loadTasks();
    } catch (err) {
      console.error('[ShipmentTasks] handleMarkComplete failed:', err);
      setSaving(null);
      await loadTasks();
      setError('Failed to mark task complete');
    }
  }

  async function handleUndo(taskId: string) {
    setSaving(taskId);
    setTasks((prev) =>
      prev.map((t) =>
        t.task_id === taskId
          ? { ...t, status: 'PENDING', completed_at: null, actual_end: null }
          : t
      )
    );

    try {
      const result = await updateShipmentTaskAction(shipmentId, taskId, { status: 'PENDING' });
      setSaving(null);

      if (!result || !result.success) {
        await loadTasks();
        setError(result?.error ?? 'Failed to undo completion');
        return;
      }
      await loadTasks();
    } catch (err) {
      console.error('[ShipmentTasks] handleUndo failed:', err);
      setSaving(null);
      await loadTasks();
      setError('Failed to undo completion');
    }
  }

  async function handleEditSave(taskId: string, updates: Record<string, unknown>) {
    setEditSaving(true);
    try {
      const result = await updateShipmentTaskAction(shipmentId, taskId, updates);
      setEditSaving(false);

      if (!result || !result.success) {
        setError(result?.error ?? 'Failed to update task');
        return;
      }

      if (result.warning) {
        setWarning(result.warning);
      }
      setEditingTask(null);
      await loadTasks();
    } catch (err) {
      console.error('[ShipmentTasks] handleEditSave failed:', err);
      setEditSaving(false);
      setError('Failed to update task');
    }
  }

  async function handleToggleVisibility(taskId: string, currentlyHidden: boolean) {
    const newVisibility = currentlyHidden ? 'VISIBLE' : 'HIDDEN';
    setSaving(taskId);

    setTasks((prev) =>
      prev.map((t) => (t.task_id === taskId ? { ...t, visibility: newVisibility } : t))
    );

    try {
      const result = await updateShipmentTaskAction(shipmentId, taskId, { visibility: newVisibility });
      setSaving(null);

      if (!result || !result.success) {
        await loadTasks();
        setError(result?.error ?? 'Failed to toggle visibility');
      }
    } catch (err) {
      console.error('[ShipmentTasks] handleToggleVisibility failed:', err);
      setSaving(null);
      await loadTasks();
      setError('Failed to toggle visibility');
    }
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="bg-white border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading tasks…</span>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error && tasks.length === 0) {
    return (
      <div className="bg-white border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // --- Empty state ---
  if (tasks.length === 0) {
    return (
      <div className="bg-white border border-[var(--border)] rounded-xl p-6">
        <div className="text-center py-8">
          <Circle className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
          <p className="text-sm text-[var(--text-muted)]">
            Tasks will be generated when incoterm and transaction type are set.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Warning toast */}
      {warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {warning}
        </div>
      )}

      {/* Task cards */}
      {tasks.map((task) => (
        <TaskCard
          key={task.task_id}
          task={task}
          orderType={orderType}
          accountType={accountType}
          onMarkComplete={handleMarkComplete}
          onUndo={handleUndo}
          onEdit={setEditingTask}
          onToggleVisibility={handleToggleVisibility}
          saving={saving}
          vesselName={vesselName}
          voyageNumber={voyageNumber}
        />
      ))}

      {/* Edit modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          accountType={accountType}
          onSave={handleEditSave}
          onClose={() => setEditingTask(null)}
          saving={editSaving}
        />
      )}
    </div>
  );
}
