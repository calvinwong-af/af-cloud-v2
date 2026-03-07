'use client';

import { useEffect } from 'react';
import { PortCombobox } from '@/components/shared/PortCombobox';
import type { Port, OrderType } from './_types';
import { INCOTERMS } from './_constants';

// ─── Props ───────────────────────────────────────────────────────────────────

interface StepRouteProps {
  originCode: string;
  setOriginCode: (p: string) => void;
  destCode: string;
  setDestCode: (p: string) => void;
  originTerminalId: string;
  setOriginTerminalId: (t: string) => void;
  destTerminalId: string;
  setDestTerminalId: (t: string) => void;
  incoterm: string;
  setIncoterm: (t: string) => void;
  ports: Port[];
  orderType: OrderType;
  transactionType: string;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

// ─── Port filtering ───────────────────────────────────────────────────────────

function isAirport(port: Port): boolean {
  // Matches port_type values like 'AIR', 'airport', 'AIRPORT', 'air_port' etc.
  return port.port_type?.toLowerCase().includes('air') ?? false;
}

function getSeaPorts(ports: Port[]): Port[] {
  return ports.filter(p => !isAirport(p));
}

function getAirports(ports: Port[]): Port[] {
  return ports.filter(p => isAirport(p));
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StepRoute({
  originCode,
  setOriginCode,
  destCode,
  setDestCode,
  originTerminalId,
  setOriginTerminalId,
  destTerminalId,
  setDestTerminalId,
  incoterm,
  setIncoterm,
  ports,
  orderType,
  transactionType,
}: StepRouteProps) {
  const seaPorts = getSeaPorts(ports);
  const airports = getAirports(ports);
  const activePorts = orderType === 'AIR' ? airports : seaPorts;
  const portOptions = activePorts.map(p => ({
    value: p.un_code,
    label: p.name || p.un_code,
    sublabel: `${p.un_code}${p.country_name ? ' · ' + p.country_name : ''}`,
    has_terminals: p.has_terminals,
    terminals: p.terminals ?? [],
  }));

  const availableIncoterms = INCOTERMS.filter(code => {
    if (transactionType === 'EXPORT' && code === 'EXW') return false;
    return true;
  });
  const incotermOptions = availableIncoterms.map(i => ({ value: i, label: i }));

  // Clear incoterm if EXW selected and user switches to EXPORT
  useEffect(() => {
    if (transactionType === 'EXPORT' && incoterm === 'EXW') {
      setIncoterm('');
    }
  }, [transactionType, incoterm, setIncoterm]);

  const originPort = activePorts.find(p => p.un_code === originCode);
  const destPort = activePorts.find(p => p.un_code === destCode);

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel required>Origin Port</FieldLabel>
        <PortCombobox
          value={originCode}
          onChange={setOriginCode}
          onTerminalChange={setOriginTerminalId}
          options={portOptions}
          withTerminal
          terminalValue={originTerminalId}
          placeholder="Search by port name or UN code…"
        />
        {originPort && (
          <p className="text-xs text-[var(--text-muted)] mt-1">{originPort.un_code} · {originPort.country_name}</p>
        )}
      </div>
      <div>
        <FieldLabel required>Destination Port</FieldLabel>
        <PortCombobox
          value={destCode}
          onChange={setDestCode}
          onTerminalChange={setDestTerminalId}
          options={portOptions}
          withTerminal
          terminalValue={destTerminalId}
          placeholder="Search by port name or UN code…"
        />
        {destPort && (
          <p className="text-xs text-[var(--text-muted)] mt-1">{destPort.un_code} · {destPort.country_name}</p>
        )}
      </div>
      <div>
        <FieldLabel required>Incoterm</FieldLabel>
        <PortCombobox
          value={incoterm}
          onChange={setIncoterm}
          options={incotermOptions}
          placeholder="Select or type incoterm…"
        />
      </div>
    </div>
  );
}
