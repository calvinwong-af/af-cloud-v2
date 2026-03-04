'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Plus, Trash2, Loader2, AlertTriangle, Anchor,
} from 'lucide-react';
import {
  getRouteNodesAction,
  saveRouteNodesAction,
  type RouteNode,
} from '@/app/actions/shipments-route';
import { formatDate } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RouteNodeTimelineProps {
  shipmentId: string;
  accountType: string | null;
  userRole: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canEditNodes(accountType: string | null, userRole: string | null): boolean {
  if (accountType === 'AFU') return true;
  if (accountType === 'AFC' && (userRole === 'AFC-ADMIN' || userRole === 'AFC-M')) return true;
  return false;
}

function canRemoveNodes(accountType: string | null): boolean {
  return accountType === 'AFU';
}

const ROLE_LABELS: Record<string, string> = {
  ORIGIN: 'POL',
  TRANSHIP: 'T/S',
  DESTINATION: 'POD',
};

const ROLE_COLORS: Record<string, string> = {
  ORIGIN: 'text-blue-600',
  TRANSHIP: 'text-amber-600',
  DESTINATION: 'text-emerald-600',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RouteNodeTimeline({ shipmentId, accountType, userRole }: RouteNodeTimelineProps) {
  const [nodes, setNodes] = useState<RouteNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [derived, setDerived] = useState(true);

  const editable = canEditNodes(accountType, userRole);
  const removable = canRemoveNodes(accountType);

  const loadNodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRouteNodesAction(shipmentId);
      if (!result) {
        setError('No response');
        setLoading(false);
        return;
      }
      if (result.success) {
        setNodes(result.data ?? []);
        setDerived(result.derived);
      } else {
        setError(result.error);
      }
    } catch {
      setError('Failed to load route');
    }
    setLoading(false);
  }, [shipmentId]);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  async function handleAddTranship(afterIndex: number) {
    const newNodes = [...nodes];
    const newNode: RouteNode = {
      port_un_code: '',
      port_name: '',
      sequence: 0,
      role: 'TRANSHIP',
      scheduled_eta: null,
      actual_eta: null,
      scheduled_etd: null,
      actual_etd: null,
    };
    newNodes.splice(afterIndex + 1, 0, newNode);

    setSaving(true);
    try {
      const result = await saveRouteNodesAction(shipmentId, newNodes);
      if (!result || !result.success) {
        setError(result?.error ?? 'Failed to add transhipment');
      }
      await loadNodes();
    } catch {
      setError('Failed to add transhipment');
    }
    setSaving(false);
  }

  async function handleRemoveTranship(index: number) {
    const newNodes = nodes.filter((_, i) => i !== index);

    setSaving(true);
    try {
      const result = await saveRouteNodesAction(shipmentId, newNodes);
      if (!result || !result.success) {
        setError(result?.error ?? 'Failed to remove node');
      }
      await loadNodes();
    } catch {
      setError('Failed to remove node');
    }
    setSaving(false);
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="bg-white border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading route...</span>
        </div>
      </div>
    );
  }

  // --- Error ---
  if (error && nodes.length === 0) {
    return (
      <div className="bg-white border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // --- Empty ---
  if (nodes.length === 0) {
    return (
      <div className="bg-white border border-[var(--border)] rounded-xl p-6">
        <div className="text-center py-4">
          <MapPin className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[var(--text-muted)]">No route nodes available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5">
      {error && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Horizontal timeline */}
      <div className="flex items-start overflow-x-auto pb-2">
        {nodes.map((node, i) => (
          <div key={node.sequence} className="flex items-start flex-shrink-0">
            {/* Node */}
            <div className="relative flex flex-col items-center min-w-[100px]">
              {/* Port code circle — display only */}
              <div
                title={node.port_name || undefined}
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  node.port_name ? 'cursor-help' : ''
                } ${
                  node.role === 'ORIGIN'
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : node.role === 'DESTINATION'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-amber-300 bg-amber-50 text-amber-700'
                }`}
              >
                {node.port_un_code ? node.port_un_code.slice(0, 5) : '?'}
              </div>

              {/* Role label */}
              <span className={`mt-1.5 text-[10px] font-semibold ${ROLE_COLORS[node.role] ?? 'text-[var(--text-muted)]'}`}>
                {ROLE_LABELS[node.role] ?? node.role}
              </span>

              {/* Timing info */}
              <div className="mt-1 text-center space-y-0.5">
                {(node.role === 'ORIGIN' || node.role === 'TRANSHIP') && (
                  <div className="text-[10px]">
                    {node.actual_etd ? (
                      <>
                        <span className="font-medium text-[var(--text)]">ATD: {formatDate(node.actual_etd)}</span>
                        {node.scheduled_etd && node.scheduled_etd !== node.actual_etd && (
                          <div className="text-[9px] text-[var(--text-muted)] line-through">{formatDate(node.scheduled_etd)}</div>
                        )}
                      </>
                    ) : node.scheduled_etd ? (
                      <span className="text-[var(--text-mid)]">ETD: {formatDate(node.scheduled_etd)}</span>
                    ) : (
                      <span className="text-[var(--text-muted)]">ETD: —</span>
                    )}
                  </div>
                )}
                {(node.role === 'DESTINATION' || node.role === 'TRANSHIP') && (
                  <div className="text-[10px]">
                    {node.actual_eta ? (
                      <>
                        <span className="font-medium text-[var(--text)]">ATA: {formatDate(node.actual_eta)}</span>
                        {node.scheduled_eta && node.scheduled_eta !== node.actual_eta && (
                          <div className="text-[9px] text-[var(--text-muted)] line-through">{formatDate(node.scheduled_eta)}</div>
                        )}
                      </>
                    ) : node.scheduled_eta ? (
                      <span className="text-[var(--text-mid)]">ETA: {formatDate(node.scheduled_eta)}</span>
                    ) : (
                      <span className="text-[var(--text-muted)]">ETA: —</span>
                    )}
                  </div>
                )}
              </div>

              {/* Remove button for transhipment nodes */}
              {removable && !derived && node.role === 'TRANSHIP' && (
                <button
                  onClick={() => handleRemoveTranship(i)}
                  disabled={saving}
                  className="mt-1 p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Remove transhipment"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Connector line + add button */}
            {i < nodes.length - 1 && (
              <div className="flex flex-col items-center justify-start pt-5 mx-1">
                <div className="w-12 h-0.5 bg-[var(--border)] relative">
                  <Anchor className="w-3 h-3 text-[var(--text-muted)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                {editable && !derived && (
                  <button
                    onClick={() => handleAddTranship(i)}
                    disabled={saving}
                    className="mt-1 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-mist)] transition-colors disabled:opacity-50"
                    title="Add transhipment"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {derived && (
        <p className="mt-2 text-[10px] text-[var(--text-muted)] italic">
          Route derived from origin/destination ports. Save route nodes to enable editing.
        </p>
      )}
    </div>
  );
}
