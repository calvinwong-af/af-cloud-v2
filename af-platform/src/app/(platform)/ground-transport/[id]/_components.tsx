'use client';

import { useState } from 'react';
import { Loader2, X, Pencil } from 'lucide-react';
import {
  updateGroundTransportOrderAction,
  addLegAction,
  updateLegAction,
} from '@/app/actions/ground-transport';
import type { GroundTransportOrder, GroundTransportLeg } from '@/app/actions/ground-transport';
import { AddressInput } from '@/components/ground-transport/AddressInput';
import type { AddressValue } from '@/components/ground-transport/AddressInput';
import type { City, HaulageArea } from '@/lib/types';

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const GT_STATUS_STYLES: Record<string, string> = {
  draft:       'bg-gray-100 text-gray-700',
  confirmed:   'bg-blue-100 text-blue-800',
  dispatched:  'bg-sky-100 text-sky-800',
  in_transit:  'bg-amber-100 text-amber-800',
  detained:    'bg-orange-100 text-orange-800',
  completed:   'bg-emerald-100 text-emerald-800',
  cancelled:   'bg-red-100 text-red-700',
};

const LEG_STATUS_STYLES: Record<string, string> = {
  pending:    'bg-gray-100 text-gray-700',
  in_transit: 'bg-amber-100 text-amber-800',
  completed:  'bg-emerald-100 text-emerald-800',
};

const LEG_TYPE_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  pickup:   'Pickup',
  transfer: 'Transfer',
  return:   'Return',
};

const inputCls =
  'w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--sky)]';

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

function getValidNextStatuses(current: string, detentionMode: string | null): string[] {
  switch (current) {
    case 'draft':      return ['confirmed', 'cancelled'];
    case 'confirmed':  return ['dispatched', 'cancelled'];
    case 'dispatched': return ['in_transit'];
    case 'in_transit':
      return detentionMode === 'detained'
        ? ['detained', 'completed']
        : ['completed'];
    case 'detained':   return ['in_transit', 'completed'];
    default:           return [];
  }
}

// ---------------------------------------------------------------------------
// StatusDropdown
// ---------------------------------------------------------------------------

export function StatusDropdown({
  order,
  onUpdated,
}: {
  order: GroundTransportOrder;
  onUpdated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const nextStatuses = getValidNextStatuses(order.status, order.detention_mode);
  if (nextStatuses.length === 0) return null;

  async function handleChange(newStatus: string) {
    setSaving(true);
    setOpen(false);
    try {
      const result = await updateGroundTransportOrderAction(order.transport_order_id, { status: newStatus });
      if (result && result.success) onUpdated();
    } catch { /* handled by caller */ }
    setSaving(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
      >
        {saving ? 'Updating…' : 'Change Status'}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg z-10 min-w-[140px]">
          {nextStatuses.map((s) => (
            <button
              key={s}
              onClick={() => handleChange(s)}
              className="block w-full text-left px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface)] transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mr-2 ${GT_STATUS_STYLES[s] ?? ''}`}>
                {s.replace(/_/g, ' ')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionCard (local to GT detail)
// ---------------------------------------------------------------------------

export function GTSectionCard({ title, icon, children, action }: {
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

export function GTDataRow({ label, value, mono = false }: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-[var(--border)] last:border-0">
      <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{label}</span>
      <span className={`text-sm text-[var(--text)] text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Order Modal
// ---------------------------------------------------------------------------

export function EditOrderModal({
  order,
  onSaved,
  onClose,
}: {
  order: GroundTransportOrder;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [vendorId, setVendorId] = useState(order.vendor_id ?? '');
  const [driverName, setDriverName] = useState(order.driver_name ?? '');
  const [driverContact, setDriverContact] = useState(order.driver_contact ?? '');
  const [vehiclePlate, setVehiclePlate] = useState(order.vehicle_plate ?? '');
  const [equipmentType, setEquipmentType] = useState(order.equipment_type ?? '');
  const [equipmentNumber, setEquipmentNumber] = useState(order.equipment_number ?? '');
  const [detentionMode, setDetentionMode] = useState(order.detention_mode ?? '');
  const [detentionFreeDays, setDetentionFreeDays] = useState(order.detention_free_days?.toString() ?? '');
  const [notes, setNotes] = useState(order.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (vendorId !== (order.vendor_id ?? '')) payload.vendor_id = vendorId || null;
      if (driverName !== (order.driver_name ?? '')) payload.driver_name = driverName || null;
      if (driverContact !== (order.driver_contact ?? '')) payload.driver_contact = driverContact || null;
      if (vehiclePlate !== (order.vehicle_plate ?? '')) payload.vehicle_plate = vehiclePlate || null;
      if (equipmentType !== (order.equipment_type ?? '')) payload.equipment_type = equipmentType || null;
      if (equipmentNumber !== (order.equipment_number ?? '')) payload.equipment_number = equipmentNumber || null;
      if (detentionMode !== (order.detention_mode ?? '')) payload.detention_mode = detentionMode || null;
      if (detentionFreeDays !== (order.detention_free_days?.toString() ?? ''))
        payload.detention_free_days = detentionFreeDays ? parseInt(detentionFreeDays, 10) : null;
      if (notes !== (order.notes ?? '')) payload.notes = notes || null;

      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }

      const result = await updateGroundTransportOrderAction(order.transport_order_id, payload);
      if (!result) { setError('No response'); setSaving(false); return; }
      if (result.success) { onSaved(); onClose(); } else { setError(result.error); }
    } catch { setError('Failed to update'); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">Edit Order</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)]"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div><label className="text-xs text-[var(--text-muted)]">Vendor ID</label><input type="text" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs text-[var(--text-muted)]">Driver Name</label><input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs text-[var(--text-muted)]">Driver Contact</label><input type="text" value={driverContact} onChange={(e) => setDriverContact(e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs text-[var(--text-muted)]">Vehicle Plate</label><input type="text" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} className={inputCls} /></div>
          {order.transport_type === 'haulage' && (
            <>
              <div><label className="text-xs text-[var(--text-muted)]">Equipment Type</label><input type="text" value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} className={inputCls} /></div>
              <div><label className="text-xs text-[var(--text-muted)]">Equipment Number</label><input type="text" value={equipmentNumber} onChange={(e) => setEquipmentNumber(e.target.value)} className={inputCls} /></div>
              <div><label className="text-xs text-[var(--text-muted)]">Detention Mode</label>
                <select value={detentionMode} onChange={(e) => setDetentionMode(e.target.value)} className={inputCls}>
                  <option value="">None</option>
                  <option value="direct">Direct</option>
                  <option value="detained">Detained</option>
                </select>
              </div>
              <div><label className="text-xs text-[var(--text-muted)]">Detention Free Days</label><input type="number" value={detentionFreeDays} onChange={(e) => setDetentionFreeDays(e.target.value)} className={inputCls} /></div>
            </>
          )}
          <div><label className="text-xs text-[var(--text-muted)]">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} /></div>
          {error && <p className="text-xs text-red-600">{error}</p>}
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

// ---------------------------------------------------------------------------
// Add Leg Modal
// ---------------------------------------------------------------------------

export function AddLegModal({
  transportOrderId,
  nextSequence,
  cities,
  haulageAreas,
  onSaved,
  onClose,
}: {
  transportOrderId: string;
  nextSequence: number;
  cities: City[];
  haulageAreas: HaulageArea[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [legType, setLegType] = useState<'delivery' | 'pickup' | 'transfer' | 'return'>('delivery');
  const [origin, setOrigin] = useState<AddressValue>({ address_line: null, city_id: null, haulage_area_id: null, lat: null, lng: null });
  const [destination, setDestination] = useState<AddressValue>({ address_line: null, city_id: null, haulage_area_id: null, lat: null, lng: null });
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await addLegAction(transportOrderId, {
        leg_sequence: nextSequence,
        leg_type: legType,
        origin_city_id: origin.city_id,
        origin_haulage_area_id: origin.haulage_area_id,
        origin_address_line: origin.address_line,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        dest_city_id: destination.city_id,
        dest_haulage_area_id: destination.haulage_area_id,
        dest_address_line: destination.address_line,
        dest_lat: destination.lat,
        dest_lng: destination.lng,
        scheduled_date: scheduledDate || null,
        notes: notes || null,
      });
      if (!result) { setError('No response'); setSaving(false); return; }
      if (result.success) { onSaved(); onClose(); } else { setError(result.error); }
    } catch { setError('Failed to add leg'); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">Add Leg #{nextSequence}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)]"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Leg Type</label>
            <select value={legType} onChange={(e) => setLegType(e.target.value as typeof legType)} className={`${inputCls} mt-1`}>
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
              <option value="transfer">Transfer</option>
              <option value="return">Return</option>
            </select>
          </div>
          <AddressInput label="Origin" value={origin} onChange={setOrigin} haulageAreas={haulageAreas} cities={cities} />
          <AddressInput label="Destination" value={destination} onChange={setDestination} haulageAreas={haulageAreas} cities={cities} />
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Scheduled Date</label>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={`${inputCls} mt-1`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} mt-1 resize-none`} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-mid)]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-[var(--sky)] text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Adding…' : 'Add Leg'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Leg Modal
// ---------------------------------------------------------------------------

export function EditLegModal({
  transportOrderId,
  leg,
  cities,
  haulageAreas,
  onSaved,
  onClose,
}: {
  transportOrderId: string;
  leg: GroundTransportLeg;
  cities: City[];
  haulageAreas: HaulageArea[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [origin, setOrigin] = useState<AddressValue>({
    address_line: leg.origin_address_line ?? null,
    city_id: leg.origin_city_id ?? null,
    haulage_area_id: leg.origin_haulage_area_id ?? null,
    lat: leg.origin_lat ?? null,
    lng: leg.origin_lng ?? null,
  });
  const [destination, setDestination] = useState<AddressValue>({
    address_line: leg.dest_address_line ?? null,
    city_id: leg.dest_city_id ?? null,
    haulage_area_id: leg.dest_haulage_area_id ?? null,
    lat: leg.dest_lat ?? null,
    lng: leg.dest_lng ?? null,
  });
  const [scheduledDate, setScheduledDate] = useState(leg.scheduled_date ?? '');
  const [actualDate, setActualDate] = useState(leg.actual_date ?? '');
  const [status, setStatus] = useState(leg.status ?? 'pending');
  const [notes, setNotes] = useState(leg.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<GroundTransportLeg> = {
        origin_city_id: origin.city_id,
        origin_haulage_area_id: origin.haulage_area_id,
        origin_address_line: origin.address_line,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        dest_city_id: destination.city_id,
        dest_haulage_area_id: destination.haulage_area_id,
        dest_address_line: destination.address_line,
        dest_lat: destination.lat,
        dest_lng: destination.lng,
        scheduled_date: scheduledDate || null,
        actual_date: actualDate || null,
        status,
        notes: notes || null,
      };
      const result = await updateLegAction(transportOrderId, leg.leg_id!, payload);
      if (!result) { setError('No response'); setSaving(false); return; }
      if (result.success) { onSaved(); onClose(); } else { setError(result.error); }
    } catch { setError('Failed to update leg'); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">Edit Leg #{leg.leg_sequence}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)]"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <AddressInput label="Origin" value={origin} onChange={setOrigin} haulageAreas={haulageAreas} cities={cities} />
          <AddressInput label="Destination" value={destination} onChange={setDestination} haulageAreas={haulageAreas} cities={cities} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-muted)]">Scheduled Date</label>
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)]">Actual Date</label>
              <input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Leg Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="pending">Pending</option>
              <option value="in_transit">In Transit</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
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

// ---------------------------------------------------------------------------
// Legs Card
// ---------------------------------------------------------------------------

export function LegsCard({
  order,
  onAddLeg,
  onEditLeg,
}: {
  order: GroundTransportOrder;
  onAddLeg: () => void;
  onEditLeg: (leg: GroundTransportLeg) => void;
}) {
  const legs = (order.legs ?? []).sort((a, b) => a.leg_sequence - b.leg_sequence);

  return (
    <GTSectionCard
      title="Legs"
      icon={<span className="text-sm">🛣</span>}
      action={
        <button
          onClick={onAddLeg}
          className="text-xs text-[var(--sky)] hover:underline font-medium"
        >
          + Add Leg
        </button>
      }
    >
      {legs.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] italic">No legs</p>
      ) : (
        <div className="space-y-3">
          {legs.map((leg) => (
            <div
              key={leg.leg_id}
              className="border border-[var(--border)] rounded-lg p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-[var(--text-muted)]">
                    #{leg.leg_sequence}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${LEG_STATUS_STYLES[leg.status ?? 'pending'] ?? 'bg-gray-100 text-gray-700'}`}>
                    {(leg.status ?? 'pending').replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-[var(--text-mid)]">
                    {LEG_TYPE_LABELS[leg.leg_type] ?? leg.leg_type}
                  </span>
                </div>
                <button
                  onClick={() => onEditLeg(leg)}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
                  title="Edit leg"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              <div className="text-xs text-[var(--text-mid)]">
                <span className="font-medium">Origin:</span>{' '}
                {leg.origin_address_line ?? '—'}
              </div>
              <div className="text-xs text-[var(--text-mid)]">
                <span className="font-medium">Dest:</span>{' '}
                {leg.dest_address_line ?? '—'}
              </div>
              {(leg.scheduled_date || leg.actual_date) && (
                <div className="text-xs text-[var(--text-muted)] flex gap-4">
                  {leg.scheduled_date && <span>Scheduled: {leg.scheduled_date}</span>}
                  {leg.actual_date && <span>Actual: {leg.actual_date}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </GTSectionCard>
  );
}

export { GT_STATUS_STYLES };
