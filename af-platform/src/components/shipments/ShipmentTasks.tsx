'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, Circle, Lock, Loader2, Eye, EyeOff,
  Pencil, X, Clock, AlertTriangle, Truck, Ship as ShipIcon,
  FileCheck, FileSearch, PackageCheck, Undo2,
} from 'lucide-react';
import { fetchShipmentTasksAction, updateShipmentTaskAction } from '@/app/actions/shipments-write';
import type { WorkflowTask } from '@/app/actions/shipments-write';
import { formatDate } from '@/lib/utils';

interface ShipmentTasksProps {
  shipmentId: string;
  orderType: string;
  accountType: string | null;
  userRole: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_LABELS: Record<string, string> = {
  ORIGIN_HAULAGE: 'Origin Haulage',
  FREIGHT_BOOKING: 'Freight Booking',
  EXPORT_CLEARANCE: 'Export Clearance',
  IMPORT_CLEARANCE: 'Import Clearance',
  DESTINATION_HAULAGE: 'Destination Haulage',
};

/** Returns display label adjusted for order type — LCL/Air use "Ground Transportation" instead of "Haulage" */
function getTaskLabel(taskType: string, orderType: string): string {
  const usesGround = orderType === 'SEA_LCL' || orderType === 'AIR';
  if (usesGround) {
    if (taskType === 'ORIGIN_HAULAGE') return 'Origin Ground Transportation';
    if (taskType === 'DESTINATION_HAULAGE') return 'Destination Ground Transportation';
  }
  return TASK_LABELS[taskType] ?? taskType;
}

const TASK_ICONS: Record<string, React.ReactNode> = {
  ORIGIN_HAULAGE: <Truck className="w-4 h-4" />,
  FREIGHT_BOOKING: <ShipIcon className="w-4 h-4" />,
  EXPORT_CLEARANCE: <FileCheck className="w-4 h-4" />,
  IMPORT_CLEARANCE: <FileSearch className="w-4 h-4" />,
  DESTINATION_HAULAGE: <PackageCheck className="w-4 h-4" />,
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-400' },
  IN_PROGRESS: { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  COMPLETED:   { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  BLOCKED:     { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
};

const ASSIGNED_LABELS: Record<string, string> = {
  AF: 'AcceleFreight',
  CUSTOMER: 'Customer',
  THIRD_PARTY: 'Third Party',
};

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

function canEdit(accountType: string | null, userRole: string | null): boolean {
  if (accountType === 'AFU') return true;
  if (accountType === 'AFC' && (userRole === 'AFC-ADMIN' || userRole === 'AFC-M')) return true;
  return false;
}

function canToggleVisibility(accountType: string | null): boolean {
  return accountType === 'AFU';
}

// ---------------------------------------------------------------------------
// Task card sub-component
// ---------------------------------------------------------------------------

function TaskCard({
  task,
  orderType,
  accountType,
  userRole,
  onMarkComplete,
  onUndo,
  onEdit,
  onToggleVisibility,
  saving,
}: {
  task: WorkflowTask;
  orderType: string;
  accountType: string | null;
  userRole: string | null;
  onMarkComplete: (taskId: string) => void;
  onUndo: (taskId: string) => void;
  onEdit: (task: WorkflowTask) => void;
  onToggleVisibility: (taskId: string, visible: boolean) => void;
  saving: string | null;
}) {
  const style = STATUS_STYLES[task.status] ?? STATUS_STYLES.PENDING;
  const isHidden = task.visibility === 'HIDDEN';
  const isSaving = saving === task.task_id;
  const editable = canEdit(accountType, userRole);
  const showComplete = editable && (task.status === 'PENDING' || task.status === 'IN_PROGRESS');
  const showUndo = editable && task.status === 'COMPLETED';
  const label = getTaskLabel(task.task_type, orderType);

  return (
    <div
      className={`bg-white border border-[var(--border)] rounded-xl p-4 transition-opacity ${
        isHidden ? 'opacity-50' : ''
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
              <span className={`text-sm font-semibold ${isHidden ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text)]'}`}>
                {label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.bg} ${style.text}`}>
                {task.status.replace('_', ' ')}
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
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
              title={isHidden ? 'Show to customer' : 'Hide from customer'}
            >
              {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
          {editable && task.status !== 'COMPLETED' && (
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

      {/* Details row */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span className="text-[var(--text-muted)]">Assigned to</span>
          <div className="text-[var(--text-mid)] font-medium">
            {task.assigned_to === 'THIRD_PARTY' && task.third_party_name
              ? task.third_party_name
              : ASSIGNED_LABELS[task.assigned_to] ?? task.assigned_to}
          </div>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Due</span>
          <div className="text-[var(--text-mid)] font-medium">
            {task.due_date ? formatDate(task.due_date) : '—'}
          </div>
        </div>
        {task.completed_at && (
          <div>
            <span className="text-[var(--text-muted)]">Completed</span>
            <div className="text-emerald-600 font-medium">{formatDate(task.completed_at)}</div>
          </div>
        )}
      </div>

      {/* Notes */}
      {task.notes && (
        <div className="mt-2 text-xs text-[var(--text-mid)] bg-[var(--surface)] rounded-lg px-3 py-2 border border-[var(--border)]">
          {task.notes}
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
  orderType,
  onSave,
  onClose,
  saving,
}: {
  task: WorkflowTask;
  orderType: string;
  onSave: (taskId: string, updates: Record<string, unknown>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [status, setStatus] = useState(task.status);
  const [assignedTo, setAssignedTo] = useState(task.assigned_to);
  const [thirdPartyName, setThirdPartyName] = useState(task.third_party_name ?? '');
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
  const [notes, setNotes] = useState(task.notes ?? '');

  function handleSave() {
    const updates: Record<string, unknown> = {};
    if (status !== task.status) updates.status = status;
    if (assignedTo !== task.assigned_to) updates.assigned_to = assignedTo;
    if (assignedTo === 'THIRD_PARTY' && thirdPartyName !== (task.third_party_name ?? '')) {
      updates.third_party_name = thirdPartyName || null;
    }
    if (dueDate !== (task.due_date ?? '')) {
      updates.due_date = dueDate || null;
      updates.due_date_override = true;
    }
    if (notes !== (task.notes ?? '')) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }
    onSave(task.task_id, updates);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Edit {getTaskLabel(task.task_type, orderType)}
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Status */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]"
            >
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>

          {/* Assigned to */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Assigned to</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]"
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
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]"
              />
            </div>
          )}

          {/* Due date */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes…"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)]">
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

export default function ShipmentTasks({ shipmentId, orderType, accountType, userRole }: ShipmentTasksProps) {
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
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.task_id === taskId
          ? { ...t, status: 'COMPLETED', completed_at: new Date().toISOString() }
          : t
      )
    );

    try {
      const result = await updateShipmentTaskAction(shipmentId, taskId, { status: 'COMPLETED' });
      setSaving(null);

      if (!result || !result.success) {
        // Revert optimistic update
        await loadTasks();
        setError(result?.error ?? 'Failed to mark task complete');
        return;
      }

      if (result.warning) {
        setWarning(result.warning);
      }
      // Reload to get server state (e.g. unblocked tasks)
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
    // Optimistic update — revert to PENDING
    setTasks((prev) =>
      prev.map((t) =>
        t.task_id === taskId
          ? { ...t, status: 'PENDING', completed_at: null }
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

    // Optimistic update
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
          userRole={userRole}
          onMarkComplete={handleMarkComplete}
          onUndo={handleUndo}
          onEdit={setEditingTask}
          onToggleVisibility={handleToggleVisibility}
          saving={saving}
        />
      ))}

      {/* Edit modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          orderType={orderType}
          onSave={handleEditSave}
          onClose={() => setEditingTask(null)}
          saving={editSaving}
        />
      )}
    </div>
  );
}
