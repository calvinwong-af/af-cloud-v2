'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MapPin, Package, Users, AlertTriangle, Loader2, Ship,
  Container, Weight, Activity, ChevronDown, ChevronRight, Pencil, X,
  Clock, CheckCircle, RotateCcw,
} from 'lucide-react';
import { fetchStatusHistoryAction, fetchCompaniesForShipmentAction, reassignShipmentCompanyAction } from '@/app/actions/shipments';
import type { StatusHistoryEntry } from '@/app/actions/shipments';
import { updateShipmentStatusAction, updateInvoicedStatusAction, updateCompletedFlagAction, updatePartiesAction, updateShipmentPortAction, updateIncotermAction, updateBookingAction } from '@/app/actions/shipments-write';
import type { UpdateBookingPayload } from '@/app/actions/shipments-write';
import { updateShipmentScopeAction, reconcileShipmentGroundTransportAction } from '@/app/actions/ground-transport';
import type { ScopeFlags, ReconcileResult, GroundTransportOrder } from '@/app/actions/ground-transport';
import { formatDate } from '@/lib/utils';
import type { ShipmentOrder, ShipmentOrderStatus, TypeDetailsFCL, TypeDetailsLCL } from '@/lib/types';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLOR, getStatusPathList, normalizeStatusToNumeric } from '@/lib/types';
import PortPair from '@/components/shared/PortPair';
import { getPortLabel, type Port } from '@/lib/ports';

// ─── Status styles ───────────────────────────────────────────────────────────

export const STATUS_STYLES: Record<string, string> = {
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

export function SectionCard({ title, icon, children, action }: {
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

export function DataRow({ label, value, mono = false }: {
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

export function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-[var(--text-muted)] italic">{message}</p>;
}

// ─── Route card ───────────────────────────────────────────────────────────────

function PortEditModal({
  currentCode,
  ports,
  field,
  shipmentId,
  onSaved,
  onClose,
}: {
  currentCode: string;
  ports: Port[];
  field: 'origin_port_un_code' | 'destination_port_un_code';
  shipmentId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPort = selected ? ports.find(p => p.un_code === selected) : null;
  const showTerminals = selectedPort?.has_terminals && selectedPort.terminals.length > 0;

  const filtered = search.trim()
    ? ports.filter(p =>
        p.un_code.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 50)
    : ports.slice(0, 50);

  function handleSelectPort(code: string) {
    setSelected(code);
    // Auto-select default terminal if port has terminals
    const port = ports.find(p => p.un_code === code);
    if (port?.has_terminals && port.terminals.length > 0) {
      const def = port.terminals.find(t => t.is_default);
      setSelectedTerminal(def?.terminal_id ?? null);
    } else {
      setSelectedTerminal(null);
    }
  }

  async function handleSave() {
    if (!selected || selected === currentCode) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateShipmentPortAction(shipmentId, {
        field,
        port_un_code: selected,
        terminal_id: showTerminals ? selectedTerminal : null,
      });
      if (!result) { setError('No response'); setSaving(false); return; }
      if (!result.success) { setError(result.error); setSaving(false); return; }
      onSaved();
      onClose();
    } catch {
      setError('Failed to update port');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">Edit Port</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <input
            autoFocus
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ports…"
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent mb-3"
          />

          <div className="max-h-56 overflow-y-auto border border-[var(--border)] rounded-lg">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-[var(--text-muted)]">No ports found</div>
            ) : (
              filtered.map(p => (
                <button
                  key={p.un_code}
                  onClick={() => handleSelectPort(p.un_code)}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-[var(--border)] last:border-0 transition-colors ${
                    selected === p.un_code
                      ? 'bg-[var(--sky-pale)] text-[var(--sky)]'
                      : p.un_code === currentCode
                      ? 'bg-gray-50 text-[var(--text-muted)]'
                      : 'hover:bg-[var(--surface)] text-[var(--text)]'
                  }`}
                >
                  <span className="font-mono font-semibold">{p.un_code}</span>
                  <span className="text-[var(--text-muted)] ml-1.5">{p.name}</span>
                </button>
              ))
            )}
          </div>

          {/* Terminal selection — shown when selected port has terminals */}
          {showTerminals && (
            <div className="mt-3">
              <p className="text-xs font-medium text-[var(--text-mid)] mb-2">Select Terminal</p>
              <div className="flex flex-wrap gap-2">
                {selectedPort.terminals.map(t => (
                  <button
                    key={t.terminal_id}
                    onClick={() => setSelectedTerminal(t.terminal_id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      selectedTerminal === t.terminal_id
                        ? 'bg-[var(--sky-pale)] text-[var(--sky)] border-[var(--sky)]'
                        : 'bg-white text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

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
            onClick={handleSave}
            disabled={!selected || selected === currentCode || saving}
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

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CNF', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

function IncotermEditModal({
  currentIncoterm,
  transactionType,
  shipmentId,
  onSaved,
  onClose,
}: {
  currentIncoterm: string;
  transactionType?: string;
  shipmentId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(currentIncoterm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableIncoterms = INCOTERMS.filter(code => {
    if (transactionType === 'EXPORT' && code === 'EXW') return false;
    return true;
  });

  async function handleSave() {
    if (selected === currentIncoterm) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateIncotermAction(shipmentId, selected || null);
      if (!result) { setError('No response'); setSaving(false); return; }
      if (!result.success) { setError(result.error); setSaving(false); return; }
      onSaved();
      onClose();
    } catch {
      setError('Failed to update incoterm');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-xs mx-4">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">Edit Incoterm</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent"
          >
            {availableIncoterms.map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>

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
            onClick={handleSave}
            disabled={selected === currentIncoterm || saving}
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

export function RouteCard({ order, accountType, polEta, polEtd, polAta, polAtd, podEta, podAta, vesselName, voyageNumber, ports, onPortUpdated }: {
  order: ShipmentOrder;
  accountType: string | null;
  polEta?: string | null;
  polEtd?: string | null;
  polAta?: string | null;
  polAtd?: string | null;
  podEta?: string | null;
  podAta?: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
  ports: Port[];
  onPortUpdated?: () => void;
}) {
  const [editingPort, setEditingPort] = useState<'origin' | 'destination' | null>(null);
  const [editingIncoterm, setEditingIncoterm] = useState(false);
  const isTerminal = order.status === -1;
  const filteredPorts = order.order_type === 'AIR'
    ? ports.filter(p => p.port_type?.toLowerCase().includes('air'))
    : ports.filter(p => !p.port_type?.toLowerCase().includes('air'));
  const originTerminalId = order.origin?.terminal_id ?? null;
  const destTerminalId = order.destination?.terminal_id ?? null;
  const originTooltip = getPortLabel(order.origin?.port_un_code, originTerminalId, ports);
  const destTooltip = getPortLabel(order.destination?.port_un_code, destTerminalId, ports);
  const isAfu = accountType === 'AFU';
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
          terminal_id: originTerminalId,
          terminal_name: originTerminalId ? (ports.find(p => p.un_code === order.origin?.port_un_code)?.terminals.find(t => t.terminal_id === originTerminalId)?.name ?? null) : null,
          port_name: originTooltip || order.origin?.label || null,
          country_code: order.origin?.country_code ?? null,
        }}
        destination={{
          port_un_code: order.destination?.port_un_code ?? null,
          terminal_id: destTerminalId,
          terminal_name: destTerminalId ? (ports.find(p => p.un_code === order.destination?.port_un_code)?.terminals.find(t => t.terminal_id === destTerminalId)?.name ?? null) : null,
          port_name: destTooltip || order.destination?.label || null,
          country_code: order.destination?.country_code ?? null,
        }}
        viewContext={isAfu ? 'customer' : 'staff'}
        originTiming={{
          eta: order.transaction_type === 'EXPORT' ? (polEta ?? null) : null,
          etd: polEtd ?? null,
          ata: polAta ?? null,
          atd: polAtd ?? null,
          showEta: order.transaction_type === 'EXPORT',
        }}
        destTiming={{
          eta: podEta ?? null,
          ata: podAta ?? null,
        }}
        incoterm={order.incoterm_code}
        orderType={order.order_type}
        size="lg"
        vesselName={vesselName}
        voyageNumber={voyageNumber}
        onEditIncoterm={isAfu && onPortUpdated && !isTerminal ? () => setEditingIncoterm(true) : undefined}
        originAction={isAfu && onPortUpdated ? (
          <button
            onClick={() => setEditingPort(editingPort === 'origin' ? null : 'origin')}
            className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
            title="Edit origin port"
          >
            <Pencil className="w-3 h-3" />
          </button>
        ) : undefined}
        destAction={isAfu && onPortUpdated ? (
          <button
            onClick={() => setEditingPort(editingPort === 'destination' ? null : 'destination')}
            className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
            title="Edit destination port"
          >
            <Pencil className="w-3 h-3" />
          </button>
        ) : undefined}
      />

      {/* Port edit modal — rendered outside the relative div for full-screen overlay */}
      {editingPort === 'origin' && onPortUpdated && (
        <PortEditModal
          currentCode={order.origin?.port_un_code ?? ''}
          ports={filteredPorts}
          field="origin_port_un_code"
          shipmentId={order.quotation_id}
          onSaved={() => { setEditingPort(null); onPortUpdated(); }}
          onClose={() => setEditingPort(null)}
        />
      )}
      {editingPort === 'destination' && onPortUpdated && (
        <PortEditModal
          currentCode={order.destination?.port_un_code ?? ''}
          ports={filteredPorts}
          field="destination_port_un_code"
          shipmentId={order.quotation_id}
          onSaved={() => { setEditingPort(null); onPortUpdated(); }}
          onClose={() => setEditingPort(null)}
        />
      )}
      {editingIncoterm && onPortUpdated && (
        <IncotermEditModal
          currentIncoterm={order.incoterm_code || 'FOB'}
          transactionType={order.transaction_type}
          shipmentId={order.quotation_id}
          onSaved={() => { setEditingIncoterm(false); onPortUpdated(); }}
          onClose={() => setEditingIncoterm(false)}
        />
      )}
    </div>
  );
}

// ─── Type details card ────────────────────────────────────────────────────────

const TYPE_SUFFIX_MAP: Record<string, string> = {
  'GP': 'GP', 'ST': 'GP', 'G0': 'GP', 'G1': 'GP',
  'HC': 'HC', 'HQ': 'HC', 'H0': 'HC', 'H1': 'HC',
  'FR': 'FR', 'FF': 'FR', 'PF': 'FR', 'P0': 'FR',
  'OT': 'OT', 'UT': 'OT', 'U0': 'OT', 'U1': 'OT',
  'RF': 'RF', 'RE': 'RF', 'R0': 'RF', 'R1': 'RF',
  'TK': 'TK', 'TN': 'TK', 'T1': 'TK',
  'BU': 'BU', 'BK': 'BU',
};

function normaliseContainerSize(raw: string | null | undefined): string {
  if (!raw) return '—';
  const upper = raw.trim().toUpperCase();
  const match = upper.match(/^(\d+)([A-Z0-9]+)$/);
  if (!match) return raw;
  const size = match[1];
  const suffix = match[2];
  const canonicalType = TYPE_SUFFIX_MAP[suffix];
  if (!canonicalType) return raw;
  return size + "' " + canonicalType;
}

export function TypeDetailsCard({ order, orderType }: { order: ShipmentOrder; orderType: string }) {
  const td = order.type_details;

  if (!td) {
    return (
      <SectionCard title="Cargo Details" icon={<Container className="w-4 h-4" />}>
        <EmptyState message="No cargo details recorded" />
      </SectionCard>
    );
  }

  if (orderType === 'SEA_FCL') {
    const fcl = td as TypeDetailsFCL;
    return (
      <SectionCard title="Containers" icon={<Container className="w-4 h-4" />}>
        {(fcl.containers?.length ?? 0) === 0
          ? <EmptyState message="No containers recorded" />
          : (
            <div className="space-y-2">
              {fcl.containers.map((c, i) => {
                const containerNum = c.container_number ?? null;
                const sealNum = c.seal_number ?? null;
                const legacyNums = c.container_numbers ?? [];
                const legacySeals = c.seal_numbers ?? [];
                return (
                  <div key={i} className="py-2 border-b border-[var(--border)] last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {c.container_size && (
                          <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs font-mono font-semibold text-[var(--text-mid)]">
                            {normaliseContainerSize(c.container_size)}
                          </span>
                        )}
                        <span className="text-sm text-[var(--text-mid)]">{c.container_type}</span>
                      </div>
                      {c.quantity && <span className="text-sm font-semibold text-[var(--text)]">x {c.quantity}</span>}
                    </div>
                    {containerNum && (
                      <div className="mt-1.5 flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">Container No.</span>
                        <span className="font-mono text-[var(--text)]">{containerNum}</span>
                      </div>
                    )}
                    {sealNum && (
                      <div className="mt-0.5 flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">Seal No.</span>
                        <span className="font-mono text-[var(--text)]">{sealNum}</span>
                      </div>
                    )}
                    {legacyNums.map((n, j) => (
                      <div key={j} className="mt-1.5 flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">Container No.</span>
                        <span className="font-mono text-[var(--text)]">{n}</span>
                      </div>
                    ))}
                    {legacySeals.map((s, j) => (
                      <div key={j} className="mt-0.5 flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">Seal No.</span>
                        <span className="font-mono text-[var(--text)]">{s}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        {fcl.containers.every(c => !c.container_number && (!c.container_numbers || c.container_numbers.length === 0)) && (
          <p className="text-xs text-[var(--text-muted)] mt-3">Container and seal numbers assigned at booking.</p>
        )}
      </SectionCard>
    );
  }

  if (orderType === 'SEA_LCL' || orderType === 'AIR') {
    const lcl = td as TypeDetailsLCL;
    const airTd = td as import('@/lib/types').TypeDetailsAir;
    const totalWeight = (lcl.packages ?? []).reduce((sum, p) => sum + (p.gross_weight_kg ?? 0), 0);
    const totalVolume = (lcl.packages ?? []).reduce((sum, p) => sum + (p.volume_cbm ?? 0), 0);

    return (
      <SectionCard title="Packages" icon={<Package className="w-4 h-4" />}>
        {(lcl.packages?.length ?? 0) === 0
          ? <EmptyState message="No packages recorded" />
          : (
            <div className="space-y-2 mb-3">
              {lcl.packages.map((p, i) => (
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

        {/* AIR-specific: chargeable weight + pieces */}
        {orderType === 'AIR' && (airTd.chargeable_weight != null || airTd.pieces != null) && (
          <div className="flex items-center gap-4 pt-3 border-t border-[var(--border)]">
            {airTd.pieces != null && (
              <div className="text-xs text-[var(--text-mid)]">
                <span className="text-[var(--text-muted)]">Pieces:</span>{' '}
                <span className="font-semibold">{airTd.pieces}</span>
              </div>
            )}
            {airTd.chargeable_weight != null && (
              <div className="text-xs text-[var(--text-mid)]">
                <span className="text-[var(--text-muted)]">Chargeable:</span>{' '}
                <span className="font-semibold">{airTd.chargeable_weight} kg</span>
              </div>
            )}
          </div>
        )}

        {/* LCL Container Reference */}
        {orderType === 'SEA_LCL' && (lcl.container_number || lcl.seal_number) && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Container Reference
            </p>
            {lcl.container_number && (
              <div className="flex items-center justify-between py-1 text-xs">
                <span className="text-[var(--text-muted)]">Container No.</span>
                <span className="font-mono text-[var(--text)]">{lcl.container_number}</span>
              </div>
            )}
            {lcl.seal_number && (
              <div className="flex items-center justify-between py-1 text-xs border-t border-[var(--border)]">
                <span className="text-[var(--text-muted)]">Seal No.</span>
                <span className="font-mono text-[var(--text)]">{lcl.seal_number}</span>
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

export function EditPartiesModal({
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
        shipper_name: shipperName,
        shipper_address: shipperAddress,
        consignee_name: consigneeName,
        consignee_address: consigneeAddress,
        notify_party_name: notifyPartyName,
        notify_party_address: notifyPartyAddress,
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

export function hasPartyDiff(
  blParty: { name: string | null; address: string | null } | null | undefined,
  orderParty: { name: string; address: string | null } | null | undefined,
): boolean {
  if (!blParty || !orderParty) return false;
  return (blParty.name ?? '') !== (orderParty.name ?? '') || (blParty.address ?? '') !== (orderParty.address ?? '');
}

export function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

export function PartiesCard({ order, onOpenDiff, accountType, onEdit }: {
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

  const numericStatus = normalizeStatusToNumeric(order.status, (order as unknown as Record<string, unknown>).sub_status as string | null);
  const canEditParties = accountType === 'AFU' && numericStatus !== 5001 && numericStatus !== -1;

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

// ─── Transport edit modal + card ──────────────────────────────────────────────

export function TransportEditModal({
  order,
  shipmentId,
  onSaved,
  onClose,
}: {
  order: ShipmentOrder;
  shipmentId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const isAir = order.order_type === 'AIR';
  const bk = (order.booking ?? {}) as Record<string, unknown>;

  // Sea fields
  const [bookingRef, setBookingRef] = useState((bk.booking_reference as string) ?? '');
  const [vessel, setVessel] = useState((bk.vessel_name as string) ?? '');
  const [voyage, setVoyage] = useState((bk.voyage_number as string) ?? '');
  const [carrier, setCarrier] = useState((bk.carrier_agent as string) ?? '');

  // Air fields
  const [mawb, setMawb] = useState(order.mawb_number ?? '');
  const [hawb, setHawb] = useState(order.hawb_number ?? '');
  const [awbType, setAwbType] = useState(order.awb_type ?? '');
  const [flightNo, setFlightNo] = useState((bk.flight_number as string) ?? '');
  const [flightDate, setFlightDate] = useState((bk.flight_date as string) ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls = 'w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]';

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: UpdateBookingPayload = isAir
        ? {
            mawb_number: mawb || null,
            hawb_number: hawb || null,
            awb_type: awbType || null,
            flight_number: flightNo || null,
            flight_date: flightDate || null,
          }
        : {
            booking_reference: bookingRef || null,
            vessel_name: vessel || null,
            voyage_number: voyage || null,
            carrier_agent: carrier || null,
          };

      const result = await updateBookingAction(shipmentId, payload);
      if (!result) { setError('No response'); setSaving(false); return; }
      if (!result.success) { setError(result.error); setSaving(false); return; }
      onSaved();
    } catch {
      setError('Failed to update transport');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">Edit Transport</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {isAir ? (
            <>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">MAWB</label>
                <input type="text" value={mawb} onChange={e => setMawb(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">HAWB</label>
                <input type="text" value={hawb} onChange={e => setHawb(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">AWB Type</label>
                <select value={awbType} onChange={e => setAwbType(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  <option value="HAWB">HAWB</option>
                  <option value="MAWB">MAWB</option>
                  <option value="Direct">Direct</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Flight Number</label>
                <input type="text" value={flightNo} onChange={e => setFlightNo(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Flight Date</label>
                <input type="date" value={flightDate} onChange={e => setFlightDate(e.target.value)} className={inputCls} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Booking Reference</label>
                <input type="text" value={bookingRef} onChange={e => setBookingRef(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Vessel</label>
                <input type="text" value={vessel} onChange={e => setVessel(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Voyage</label>
                <input type="text" value={voyage} onChange={e => setVoyage(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Carrier / Agent</label>
                <input type="text" value={carrier} onChange={e => setCarrier(e.target.value)} className={inputCls} />
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface)]">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium bg-[var(--sky)] text-white rounded-lg hover:bg-[var(--sky-dark)] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TransportCard({
  order,
  vesselName,
  voyageNumber,
  etd,
  accountType,
  onEdit,
}: {
  order: ShipmentOrder;
  vesselName: string | null;
  voyageNumber: string | null;
  etd: string | null;
  accountType: string | null;
  onEdit?: () => void;
}) {
  const bk = (order.booking ?? {}) as Record<string, unknown>;
  const bookingRef = bk.booking_reference as string || null;
  const carrierAgent = bk.carrier_agent as string || null;
  const flightNumber = bk.flight_number as string || null;
  const flightDate = bk.flight_date as string || null;
  const isAir = order.order_type === 'AIR';

  if (isAir) {
    if (!order.mawb_number && !order.hawb_number && !flightNumber && !flightDate && !etd) return null;
    return (
      <SectionCard
        title="Transport"
        icon={<Ship className="w-4 h-4" />}
        action={accountType === 'AFU' && onEdit ? (
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
            title="Edit transport"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        ) : undefined}
      >
        <DataRow label="MAWB" value={order.mawb_number} mono />
        <DataRow label="HAWB" value={order.hawb_number} mono />
        <DataRow label="AWB Type" value={order.awb_type} />
        <DataRow label="Flight" value={flightNumber} />
        <DataRow label="Flight Date" value={flightDate ? formatDate(flightDate) : null} />
        <DataRow label="ETD" value={etd ? formatDate(etd) : null} />
      </SectionCard>
    );
  }

  if (!vesselName && !voyageNumber && !bookingRef && !carrierAgent && !etd) return null;
  return (
    <SectionCard
      title="Transport"
      icon={<Ship className="w-4 h-4" />}
      action={accountType === 'AFU' && onEdit ? (
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
          title="Edit transport"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      ) : undefined}
    >
      <DataRow label="Vessel" value={vesselName} />
      <DataRow label="Voyage" value={voyageNumber} />
      <DataRow label="Booking Ref" value={bookingRef} mono />
      <DataRow label="Carrier / Agent" value={carrierAgent} />
      <DataRow label="ETD" value={etd ? formatDate(etd) : null} />
    </SectionCard>
  );
}

// ─── Status card (v2.18 — redesigned) ─────────────────────────────────────────

/** Node labels — keyed by thousands digit */
export const NODE_LABELS: Record<number, string> = {
  1: 'Pre-op',
  2: 'Confirmed',
  3: 'Booking',
  4: 'In Transit',
  5: 'End',
};

/** Sub-step labels for display below parent node */
export const SUB_LABELS: Record<number, string> = {
  1001: 'Draft',
  1002: 'Pending Review',
  3001: 'Bkg Pending',
  3002: 'Bkg Confirmed',
  4001: 'Departed',
  4002: 'Arrived',
};

export function StatusCard({ order, onReload, accountType }: { order: ShipmentOrder; onReload: () => void; accountType: string | null }) {
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [revertLoading, setRevertLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
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

  const rawSubStatus = (order as unknown as Record<string, unknown>).sub_status as string | null | undefined;
  const currentStatus = normalizeStatusToNumeric(order.status, rawSubStatus) as ShipmentOrderStatus;
  const isTerminal = currentStatus === -1;
  const isAfu = accountType === 'AFU';
  const [completedLoading, setCompletedLoading] = useState(false);

  // Determine path from incoterm + transaction_type
  const pathList = getStatusPathList(order.incoterm_code, order.transaction_type);

  // Find current position in path
  const currentIdx = pathList.indexOf(currentStatus);
  const displayIdx = currentIdx >= 0 ? currentIdx : 0;

  // Exception flag state
  const exceptionFlagged = order.exception?.flagged === true;

  // Can cancel from any non-terminal status
  const canCancel = !isTerminal;

  // Any mutation in progress — disables all action buttons
  const anyLoading = advanceLoading || revertLoading || cancelLoading || exceptionLoading || completedLoading;

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
    if (hasCurrent && currentStatus === -1) return 'past';
    if (hasCurrent) return 'current';
    const firstIdx = pathList.indexOf(nodeGroup.steps[0]);
    return firstIdx < displayIdx ? 'past' : 'future';
  }

  async function executeStatusChange(newStatus: ShipmentOrderStatus, allowJump?: boolean, reverted?: boolean) {
    setError(null);
    // Set per-action loading state
    const setLoader = newStatus === -1 ? setCancelLoading : reverted ? setRevertLoading : setAdvanceLoading;
    setLoader(true);
    setConfirmAction(null);
    setSubStepDialog(null);
    try {
      const result = await updateShipmentStatusAction(order.quotation_id, newStatus, allowJump || undefined, reverted || undefined);
      if (!result) { setError('No response from server'); setLoader(false); return; }
      if (result.success) {
        setHistoryEntries([]);
        onReload();
      } else {
        setError(result.error);
      }
    } catch {
      setError('Failed to update status');
    }
    setLoader(false);
  }

  // Clicking a FUTURE node
  function handleFutureNodeClick(nodeGroup: { node: number; label: string; steps: ShipmentOrderStatus[] }) {
    if (anyLoading || isTerminal || !isAfu) return;
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
    if (anyLoading || !isAfu) return;
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

  async function handleCompletedToggle() {
    setCompletedLoading(true);
    setError(null);
    try {
      const result = await updateCompletedFlagAction(order.quotation_id, !order.completed);
      if (!result) { setError('No response'); setCompletedLoading(false); return; }
      if (result.success) { onReload(); } else {
        setError('error' in result ? result.error : 'Failed to update');
      }
    } catch { setError('Failed to update completed status'); }
    setCompletedLoading(false);
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
            state === 'future' && isAfu ? 'cursor-pointer' :
            state === 'past' && isAfu ? 'cursor-pointer' :
            currentIncomplete && isAfu ? 'cursor-pointer' :
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
          {order.completed && (
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Completed
            </span>
          )}
        </div>
        {order.last_status_updated && (
          <span className="text-xs text-[var(--text-muted)]">
            Last updated {formatDate(order.last_status_updated)}
          </span>
        )}
      </div>

      {/* Action Buttons — AFU only */}
      {isAfu && !isTerminal && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Exception flag/clear button */}
          <button
            onClick={handleExceptionToggle}
            disabled={anyLoading}
            className={`px-4 py-2 border text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${
              exceptionFlagged
                ? 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100'
                : 'border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            {exceptionLoading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> Updating…</>
            ) : (
              exceptionFlagged ? 'Clear Exception' : '\u2691 Flag Exception'
            )}
          </button>

          {/* Cancel button */}
          {canCancel && (
            <button
              onClick={handleCancelClick}
              disabled={anyLoading}
              className="px-4 py-2 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {cancelLoading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> Updating…</>
              ) : (
                <><span>&#x2715;</span> Cancel Shipment</>
              )}
            </button>
          )}

          {/* Mark Complete — right-aligned, status >= 3002 */}
          {currentStatus >= 3002 && currentStatus !== 5001 && (
            <div className="ml-auto flex items-center gap-2">
              {order.completed && order.completed_at && (
                <span className="text-xs text-[var(--text-muted)]">
                  Completed {formatDate(order.completed_at)}
                </span>
              )}
              {order.completed ? (
                <button
                  onClick={handleCompletedToggle}
                  disabled={anyLoading}
                  className="px-3 py-2 border border-gray-300 text-gray-500 bg-white text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {completedLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…</>
                  ) : (
                    <><RotateCcw className="w-3.5 h-3.5" /> Undo</>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCompletedToggle}
                  disabled={anyLoading}
                  className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {completedLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…</>
                  ) : (
                    <><CheckCircle className="w-3.5 h-3.5" /> Mark Complete</>
                  )}
                </button>
              )}
            </div>
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

      {/* Invoiced Toggle — AFU only */}
      {isAfu && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between">
          <div>
            <span className="text-sm text-[var(--text)]">Invoiced</span>
            {invoiceLoading ? (
              <span className="text-xs text-[var(--sky)] ml-2 inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Updating…
              </span>
            ) : (
              <span className="text-xs text-[var(--text-muted)] ml-2">
                {order.completed
                  ? (order.issued_invoice ? 'Invoice processed' : 'Awaiting invoice')
                  : 'Available once shipment is marked as completed'}
              </span>
            )}
          </div>
          <button
            onClick={order.completed ? handleInvoiceToggle : undefined}
            disabled={!order.completed || invoiceLoading}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              order.issued_invoice && order.completed ? 'bg-[var(--sky)]' : 'bg-gray-300'
            } ${!order.completed ? 'opacity-40 cursor-not-allowed' : ''} ${invoiceLoading ? 'opacity-50' : ''}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              order.issued_invoice ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>
      )}

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

export function CompanyReassignModal({ shipmentId, currentCompanyId, onClose, onReassigned }: {
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

// ─── Scope Flags Card ────────────────────────────────────────────────────────

const SCOPE_LABELS: Record<string, string> = {
  first_mile_haulage:  'First Mile Haulage',
  first_mile_trucking: 'First Mile Trucking',
  export_clearance:    'Export Clearance',
  sea_freight:         'Sea / Air Freight',
  import_clearance:    'Import Clearance',
  last_mile_haulage:   'Last Mile Haulage',
  last_mile_trucking:  'Last Mile Trucking',
};

const SCOPE_KEYS: (keyof ScopeFlags)[] = [
  'first_mile_haulage', 'first_mile_trucking', 'export_clearance',
  'sea_freight', 'import_clearance', 'last_mile_haulage', 'last_mile_trucking',
];

function ScopeEditModal({
  shipmentId,
  scope,
  onSaved,
  onClose,
}: {
  shipmentId: string;
  scope: ScopeFlags;
  onSaved: (updated: ScopeFlags) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<ScopeFlags>({ ...scope });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: keyof ScopeFlags) {
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const changed: Partial<ScopeFlags> = {};
    for (const key of SCOPE_KEYS) {
      if (values[key] !== scope[key]) {
        changed[key] = values[key];
      }
    }
    if (Object.keys(changed).length === 0) {
      onClose();
      return;
    }
    try {
      const result = await updateShipmentScopeAction(shipmentId, changed);
      if (!result) { setError('No response'); setSaving(false); return; }
      if (result.success) { onSaved(result.data); onClose(); }
      else { setError(result.error); }
    } catch { setError('Failed to update scope'); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">Edit Scope</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)]"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-2">
          {SCOPE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer py-1.5">
              <input
                type="checkbox"
                checked={values[key]}
                onChange={() => toggle(key)}
                className="rounded border-[var(--border)]"
              />
              <span className="text-sm text-[var(--text)]">{SCOPE_LABELS[key]}</span>
            </label>
          ))}
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-mid)]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-[var(--sky)] text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScopeFlagsCard({
  shipmentId,
  scope: initialScope,
  accountType,
}: {
  shipmentId: string;
  scope: ScopeFlags | null;
  accountType: string | null;
}) {
  const [scope, setScope] = useState<ScopeFlags | null>(initialScope);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => { setScope(initialScope); }, [initialScope]);

  if (!scope) return null;

  return (
    <>
      <SectionCard
        title="Order Scope"
        icon={<Activity className="w-4 h-4" />}
        action={
          accountType === 'AFU' ? (
            <button
              onClick={() => setShowEdit(true)}
              className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
              title="Edit scope"
            >
              <Pencil className="w-3 h-3" />
            </button>
          ) : undefined
        }
      >
        <div className="space-y-1">
          {SCOPE_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between py-1">
              <span className="text-xs text-[var(--text-mid)]">{SCOPE_LABELS[key]}</span>
              <span className={`w-2 h-2 rounded-full ${scope[key] ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            </div>
          ))}
        </div>
      </SectionCard>

      {showEdit && (
        <ScopeEditModal
          shipmentId={shipmentId}
          scope={scope}
          onSaved={(updated) => setScope(updated)}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}

// ─── Ground Transport Reconciliation Card ────────────────────────────────────

const GT_RECONCILE_STATUS_STYLES: Record<string, string> = {
  draft:       'bg-gray-100 text-gray-700',
  confirmed:   'bg-blue-100 text-blue-800',
  dispatched:  'bg-sky-100 text-sky-800',
  in_transit:  'bg-amber-100 text-amber-800',
  detained:    'bg-orange-100 text-orange-800',
  completed:   'bg-emerald-100 text-emerald-800',
  cancelled:   'bg-red-100 text-red-700',
};

const GAP_LABELS: Record<string, { label: string; legType: 'first_mile' | 'last_mile' }> = {
  first_mile_haulage:  { label: 'First Mile Haulage', legType: 'first_mile' },
  first_mile_trucking: { label: 'First Mile Trucking', legType: 'first_mile' },
  last_mile_haulage:   { label: 'Last Mile Haulage', legType: 'last_mile' },
  last_mile_trucking:  { label: 'Last Mile Trucking', legType: 'last_mile' },
};

export function GroundTransportReconcileCard({
  shipmentId,
}: {
  shipmentId: string;
}) {
  const [data, setData] = useState<ReconcileResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result = await reconcileShipmentGroundTransportAction(shipmentId);
      if (!result) { setError('No response'); setLoading(false); return; }
      if (result.success) { setData(result.data); }
      else { setError(result.error); }
    } catch { setError('Failed to load'); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [shipmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasScope = data?.scope && SCOPE_KEYS.some((k) => data.scope[k]);
  const hasOrders = data?.orders && data.orders.length > 0;

  if (!loading && !error && !hasScope && !hasOrders) {
    return (
      <SectionCard title="Ground Transport" icon={<Container className="w-4 h-4" />}>
        <p className="text-sm text-[var(--text-muted)] italic">No ground transport in scope</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Ground Transport" icon={<Container className="w-4 h-4" />}>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
          <button onClick={fetchData} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-2">
          {data.orders.map((order: GroundTransportOrder) => (
            <div
              key={order.order_id}
              className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(`/ground-transport/${order.order_id}`, '_blank')}
                  className="text-xs font-mono text-[var(--sky)] hover:underline"
                >
                  {order.order_id}
                </button>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  order.transport_mode === 'haulage' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {order.transport_mode?.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${GT_RECONCILE_STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {order.status.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {order.legs?.length ?? 0} leg{(order.legs?.length ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}

          {data.gaps.map((gap) => {
            const info = GAP_LABELS[gap];
            return (
              <div
                key={gap}
                className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-mid)]">{info?.label ?? gap}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                    Not arranged
                  </span>
                </div>
                {info && (
                  <button
                    onClick={() => window.open(`/ground-transport?create=1&parent=${shipmentId}&leg_type=${info.legType}`, '_blank')}
                    className="text-xs text-[var(--sky)] hover:underline font-medium"
                  >
                    Create
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
