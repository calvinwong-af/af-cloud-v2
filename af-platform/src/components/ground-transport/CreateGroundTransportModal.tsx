'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createGroundTransportOrderAction } from '@/app/actions/ground-transport';
import type { GroundTransportCreatePayload, VehicleType } from '@/app/actions/ground-transport';
import { AddressInput } from './AddressInput';
import type { AddressValue } from './AddressInput';
import type { City, Area } from '@/lib/types';

interface CreateGroundTransportModalProps {
  onClose: () => void;
  onCreated?: () => void;
  cities: City[];
  areas: Area[];
  vehicleTypes: VehicleType[];
  prefillParentOrderId?: string;
  prefillLegType?: 'first_mile' | 'last_mile';
}

const inputCls =
  'w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--sky)]';

type TransportType = 'haulage' | 'trucking';
type LegType = 'first_mile' | 'last_mile' | 'standalone' | 'distribution';

const emptyAddress: AddressValue = {
  address_line: null,
  city_id: null,
  area_id: null,
  lat: null,
  lng: null,
};

export default function CreateGroundTransportModal({
  onClose,
  onCreated,
  cities,
  areas,
  vehicleTypes,
  prefillParentOrderId,
  prefillLegType,
}: CreateGroundTransportModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [transportType, setTransportType] = useState<TransportType>('trucking');
  const [vehicleTypeId, setVehicleTypeId] = useState('');
  const [legType, setLegType] = useState<LegType>(prefillLegType ?? 'standalone');
  const [parentOrderId, setParentOrderId] = useState(prefillParentOrderId ?? '');
  const [detentionMode, setDetentionMode] = useState<'direct' | 'detained'>('direct');

  // Step 2
  const [cargoDescription, setCargoDescription] = useState('');
  const [containerInput, setContainerInput] = useState('');
  const [containerNumbers, setContainerNumbers] = useState<string[]>([]);
  const [weightKg, setWeightKg] = useState('');
  const [volumeCbm, setVolumeCbm] = useState('');
  // Equipment fields moved to legs — no longer on order level

  // Step 3
  const [origin, setOrigin] = useState<AddressValue>({ ...emptyAddress });
  const [destination, setDestination] = useState<AddressValue>({ ...emptyAddress });
  const [scheduledDate, setScheduledDate] = useState('');

  function addContainer() {
    const val = containerInput.trim().toUpperCase();
    if (val && !containerNumbers.includes(val)) {
      setContainerNumbers((prev) => [...prev, val]);
    }
    setContainerInput('');
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const payload: GroundTransportCreatePayload = {
      transport_mode: transportType,
      leg_type: legType,
      parent_order_id: (legType === 'first_mile' || legType === 'last_mile') && parentOrderId ? parentOrderId : null,
      cargo_description: cargoDescription || null,
      container_numbers: containerNumbers,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
      volume_cbm: volumeCbm ? parseFloat(volumeCbm) : null,
      detention_mode: transportType === 'haulage' ? detentionMode : null,
      stops: [
        {
          sequence: 1,
          stop_type: 'pickup',
          address_line: origin.address_line,
          area_id: origin.area_id,
          city_id: origin.city_id,
          lat: origin.lat,
          lng: origin.lng,
          scheduled_arrival: scheduledDate || null,
        },
        {
          sequence: 2,
          stop_type: 'dropoff',
          address_line: destination.address_line,
          area_id: destination.area_id,
          city_id: destination.city_id,
          lat: destination.lat,
          lng: destination.lng,
        },
      ],
    };

    try {
      const result = await createGroundTransportOrderAction(payload);
      if (!result) {
        setError('No response from server');
        setSaving(false);
        return;
      }
      if (result.success) {
        window.open(`/ground-transport/${result.data.order_id}`, '_blank');
        onCreated?.();
        onClose();
      } else {
        setError(result.error);
      }
    } catch {
      setError('Failed to create order');
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">
            New Ground Transport — Step {step} of 3
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)]">
            <X size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Step 1 — Order Type */}
          {step === 1 && (
            <>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  Transport Type
                </label>
                <div className="flex gap-3 mt-2">
                  {(['trucking', 'haulage'] as const).map((t) => (
                    <label key={t} className="flex items-start gap-2 cursor-pointer flex-1 border border-[var(--border)] rounded-lg p-3 hover:bg-[var(--surface)] transition-colors">
                      <input
                        type="radio"
                        name="transport_type"
                        checked={transportType === t}
                        onChange={() => setTransportType(t)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-[var(--text)]">{t === 'trucking' ? 'Standard Trucking' : 'Haulage'}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {t === 'haulage' ? 'Equipment-based (containers, flatbeds)' : 'Cargo-based, point-to-point'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  Leg Type
                </label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {([
                    { key: 'first_mile', label: 'First Mile' },
                    { key: 'last_mile', label: 'Last Mile' },
                    { key: 'standalone', label: 'Standalone' },
                    { key: 'distribution', label: 'Distribution' },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer border border-[var(--border)] rounded-lg p-2.5 hover:bg-[var(--surface)] transition-colors">
                      <input
                        type="radio"
                        name="leg_type"
                        checked={legType === key}
                        onChange={() => setLegType(key)}
                      />
                      <span className="text-sm text-[var(--text)]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {(legType === 'first_mile' || legType === 'last_mile') && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    Parent Order ID
                  </label>
                  <input
                    type="text"
                    value={parentOrderId}
                    onChange={(e) => setParentOrderId(e.target.value)}
                    placeholder="AF-XXXXXX"
                    className={`${inputCls} mt-1`}
                  />
                </div>
              )}

              {transportType === 'haulage' && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    Detention Mode
                  </label>
                  <div className="flex gap-3 mt-2">
                    {(['direct', 'detained'] as const).map((m) => (
                      <label key={m} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="detention_mode"
                          checked={detentionMode === m}
                          onChange={() => setDetentionMode(m)}
                        />
                        <span className="text-sm text-[var(--text)] capitalize">{m}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2 — Cargo & Equipment */}
          {step === 2 && (
            <>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  Cargo Description
                </label>
                <textarea
                  value={cargoDescription}
                  onChange={(e) => setCargoDescription(e.target.value)}
                  rows={2}
                  className={`${inputCls} mt-1 resize-none`}
                  placeholder="Describe the cargo..."
                />
              </div>

              {transportType === 'trucking' ? (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    Vehicle Type
                  </label>
                  <select
                    value={vehicleTypeId}
                    onChange={(e) => setVehicleTypeId(e.target.value)}
                    className={`${inputCls} mt-1`}
                  >
                    <option value="">Select vehicle type...</option>
                    {vehicleTypes.map(vt => (
                      <option key={vt.vehicle_type_id} value={vt.vehicle_type_id}>
                        {vt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    Container Numbers
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={containerInput}
                      onChange={(e) => setContainerInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addContainer(); } }}
                      placeholder="Type and press Enter"
                      className={inputCls}
                    />
                  </div>
                  {containerNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {containerNumbers.map((cn) => (
                        <span
                          key={cn}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-[var(--surface)] border border-[var(--border)] rounded"
                        >
                          {cn}
                          <button
                            type="button"
                            onClick={() => setContainerNumbers((prev) => prev.filter((c) => c !== cn))}
                            className="text-[var(--text-muted)] hover:text-red-500"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className={`${inputCls} mt-1`}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    Volume (CBM)
                  </label>
                  <input
                    type="number"
                    value={volumeCbm}
                    onChange={(e) => setVolumeCbm(e.target.value)}
                    className={`${inputCls} mt-1`}
                    placeholder="0.00"
                  />
                </div>
              </div>

            </>
          )}

          {/* Step 3 — First Leg */}
          {step === 3 && (
            <>
              <AddressInput
                label="Origin"
                value={origin}
                onChange={setOrigin}
                areas={areas}
                cities={cities}
              />
              <AddressInput
                label="Destination"
                value={destination}
                onChange={setDestination}
                areas={areas}
                cities={cities}
              />
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className={`${inputCls} mt-1`}
                />
              </div>
            </>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border)]">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-mid)] hover:bg-[var(--surface)]"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-mid)] hover:bg-[var(--surface)]"
            >
              Cancel
            </button>
            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 2) {
                    if (transportType === 'trucking' && !vehicleTypeId) {
                      setError('Please select a vehicle type.');
                      return;
                    }
                  }
                  setError(null);
                  setStep(step + 1);
                }}
                className="px-4 py-2 text-sm bg-[var(--sky)] text-white rounded-lg hover:opacity-90"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 text-sm bg-[var(--sky)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Creating…' : 'Create Order'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
