import { Ship, Plane, Pencil } from 'lucide-react';
import { formatDate } from '@/lib/utils';

// ---------------------------------------------------------------------------
// PortPair — shared port-pair display for route cards and timeline
// ---------------------------------------------------------------------------

interface OriginTimingProps {
  eta: string | null;
  etd: string | null;
  atd: string | null;
  showEta?: boolean;
}

interface DestTimingProps {
  eta: string | null;
  ata: string | null;
}

interface PortPairProps {
  origin: {
    port_un_code: string | null;
    terminal_id?: string | null;
    terminal_name?: string | null;
    port_name?: string | null;
    country_code?: string | null;
  };
  destination: {
    port_un_code: string | null;
    terminal_id?: string | null;
    terminal_name?: string | null;
    port_name?: string | null;
    country_code?: string | null;
  };
  viewContext: 'staff' | 'customer';
  /** Legacy single-date props — used by shipment list and other simple usages */
  etd?: string | null;
  eta?: string | null;
  etdLabel?: string;
  etaLabel?: string;
  /** Stacked timing props — used by Route Card for full timing display */
  originTiming?: OriginTimingProps;
  destTiming?: DestTimingProps;
  incoterm?: string | null;
  orderType?: string;
  size?: 'lg' | 'sm';
  vesselName?: string | null;
  voyageNumber?: string | null;
  originAction?: React.ReactNode;
  destAction?: React.ReactNode;
  onEditIncoterm?: () => void;
}

const INCOTERM_COLORS: Record<string, { bg: string; text: string }> = {
  EXW: { bg: '#fef3c7', text: '#92400e' },
  FCA: { bg: '#ede9fe', text: '#5b21b6' },
  FAS: { bg: '#f3e8ff', text: '#7c3aed' },
  FOB: { bg: '#dbeafe', text: '#1d4ed8' },
  CFR: { bg: '#cffafe', text: '#0e7490' },
  CNF: { bg: '#cffafe', text: '#0e7490' },
  CIF: { bg: '#e0f2fe', text: '#0369a1' },
  CPT: { bg: '#d1fae5', text: '#065f46' },
  CIP: { bg: '#dcfce7', text: '#166534' },
  DAT: { bg: '#fce7f3', text: '#9d174d' },
  DPU: { bg: '#fce7f3', text: '#9d174d' },
  DAP: { bg: '#fee2e2', text: '#991b1b' },
  DDP: { bg: '#fecaca', text: '#7f1d1d' },
};

function IncotermPill({ code }: { code: string }) {
  const upper = code.toUpperCase();
  const colors = INCOTERM_COLORS[upper];
  if (colors) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold"
        style={{ background: colors.bg, color: colors.text }}
      >
        {upper}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs font-mono font-semibold text-[var(--text-mid)]">
      {upper}
    </span>
  );
}

export default function PortPair({
  origin,
  destination,
  viewContext,
  etd,
  eta,
  etdLabel = 'ETD',
  etaLabel = 'ETA',
  originTiming,
  destTiming,
  incoterm,
  orderType,
  size = 'lg',
  vesselName,
  voyageNumber,
  originAction,
  destAction,
  onEditIncoterm,
}: PortPairProps) {
  const originLabel = viewContext === 'staff' ? 'POL' : 'Origin';
  const destLabel = viewContext === 'staff' ? 'POD' : 'Destination';

  const originCode = origin.port_un_code || '—';
  const destCode = destination.port_un_code || '—';

  const isAir = orderType === 'AIR';
  const isLg = size === 'lg';

  const codeCls = isLg
    ? 'text-2xl font-bold font-mono text-[var(--text)] tracking-wide'
    : 'text-xs font-bold font-mono text-[var(--text)]';

  const labelCls = isLg
    ? 'text-xs text-[var(--text-muted)] mb-1'
    : 'text-[9px] text-[var(--text-muted)] mb-0.5';

  const dateLabelCls = isLg
    ? 'text-[10px] text-[var(--text-muted)]'
    : 'text-[9px] text-[var(--text-muted)]';

  const dateValueCls = isLg
    ? 'text-xs text-[var(--text-mid)] font-medium'
    : 'text-[10px] text-[var(--text-mid)]';

  const iconSize = isLg ? 'w-4 h-4' : 'w-3 h-3';
  const iconPad = isLg ? 'p-2' : 'p-1';
  const lineW = isLg ? 'w-12' : 'w-6';

  const useStackedOrigin = !!originTiming;
  const useStackedDest = !!destTiming;

  // Check if we have any stacked timing to show in the bottom row
  const hasStackedTiming = useStackedOrigin || useStackedDest;

  return (
    <div>
      <div className="flex items-center">
        {/* Origin side */}
        <div className="flex-1 min-w-0">
          <div className={labelCls}>{originLabel}</div>
          <div className="flex items-center gap-1">
            <span
              className={`${codeCls} ${origin.port_name && origin.port_name !== originCode ? 'cursor-help' : ''}`}
              title={origin.port_name && origin.port_name !== originCode ? origin.port_name : undefined}
            >
              {originCode}
            </span>
            {originAction && <span className="flex-shrink-0">{originAction}</span>}
          </div>
          {origin.terminal_id && (
            <div className={isLg ? 'text-[10px] text-[var(--text-muted)]' : 'text-[9px] text-[var(--text-muted)]'}>
              {origin.terminal_name ?? origin.terminal_id}
            </div>
          )}

          {/* Legacy single-date timing (non-stacked) */}
          {!useStackedOrigin && (
            <>
              {etd && (
                <div className="mt-1">
                  <span className={dateLabelCls}>{etdLabel} </span>
                  <span className={dateValueCls}>{formatDate(etd)}</span>
                </div>
              )}
              {!etd && isLg && (
                <div className="mt-1">
                  <span className={dateLabelCls}>{etdLabel} </span>
                  <span className={dateLabelCls}>—</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Connecting line + icon */}
        <div className="flex items-center flex-shrink-0 mx-4">
          <div className={`h-px ${lineW} bg-[var(--border)]`} />
          <div className={`${iconPad} rounded-full bg-[var(--sky-pale)] mx-2`}>
            {isAir
              ? <Plane className={`${iconSize} text-[var(--sky)]`} />
              : <Ship className={`${iconSize} text-[var(--sky)]`} />}
          </div>
          <div className={`h-px ${lineW} bg-[var(--border)]`} />
        </div>

        {/* Destination side */}
        <div className="flex-1 min-w-0 text-right">
          <div className={labelCls}>{destLabel}</div>
          <div className="flex items-center justify-end gap-1">
            {destAction && <span className="flex-shrink-0">{destAction}</span>}
            <span
              className={`${codeCls} ${destination.port_name && destination.port_name !== destCode ? 'cursor-help' : ''}`}
              title={destination.port_name && destination.port_name !== destCode ? destination.port_name : undefined}
            >
              {destCode}
            </span>
          </div>
          {destination.terminal_id && (
            <div className={isLg ? 'text-[10px] text-[var(--text-muted)]' : 'text-[9px] text-[var(--text-muted)]'}>
              {destination.terminal_name ?? destination.terminal_id}
            </div>
          )}

          {/* Legacy single-date timing (non-stacked) */}
          {!useStackedDest && (
            <>
              {eta && (
                <div className="mt-1">
                  <span className={dateLabelCls}>{etaLabel} </span>
                  <span className={dateValueCls}>{formatDate(eta)}</span>
                </div>
              )}
              {!eta && isLg && (
                <div className="mt-1">
                  <span className={dateLabelCls}>{etaLabel} </span>
                  <span className={dateLabelCls}>—</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Vessel row */}
      {isLg && (vesselName || voyageNumber) && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Ship className="w-3.5 h-3.5" />
          {vesselName && <span className="font-medium">{vesselName}</span>}
          {vesselName && voyageNumber && <span>·</span>}
          {voyageNumber && <span className="font-mono">{voyageNumber}</span>}
        </div>
      )}

      {/* Stacked timing row — below vessel, spanning full width */}
      {hasStackedTiming && (
        <div className={`${isLg ? 'mt-3 pt-3' : 'mt-1.5 pt-1.5'} border-t border-[var(--border)] flex items-start justify-between`}>
          {/* Origin timing — left aligned */}
          {useStackedOrigin ? (
            <div className="flex items-center gap-3 flex-wrap">
              {originTiming.showEta && originTiming.eta && (
                <div>
                  <span className={dateLabelCls}>ETA </span>
                  <span className={dateValueCls}>{formatDate(originTiming.eta)}</span>
                </div>
              )}
              {originTiming.etd && (
                <div>
                  <span className={dateLabelCls}>ETD </span>
                  <span className={originTiming.atd ? dateLabelCls : dateValueCls}>{formatDate(originTiming.etd)}</span>
                </div>
              )}
              {originTiming.atd && (
                <div>
                  <span className={isLg ? 'text-[10px] text-[var(--sky)] font-medium' : 'text-[9px] text-[var(--sky)] font-medium'}>ATD </span>
                  <span className={isLg ? 'text-xs text-[var(--sky)] font-medium' : 'text-[10px] text-[var(--sky)] font-medium'}>{formatDate(originTiming.atd)}</span>
                </div>
              )}
              {!originTiming.etd && !originTiming.atd && isLg && (
                <div>
                  <span className={dateLabelCls}>ETD </span>
                  <span className={dateLabelCls}>—</span>
                </div>
              )}
            </div>
          ) : <div />}

          {/* Destination timing — right aligned */}
          {useStackedDest ? (
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {destTiming.eta && (
                <div>
                  <span className={destTiming.ata ? dateLabelCls : dateValueCls}>{formatDate(destTiming.eta)}</span>
                  <span className={dateLabelCls}> ETA</span>
                </div>
              )}
              {destTiming.ata && (
                <div>
                  <span className={isLg ? 'text-xs text-[var(--sky)] font-medium' : 'text-[10px] text-[var(--sky)] font-medium'}>{formatDate(destTiming.ata)}</span>
                  <span className={isLg ? 'text-[10px] text-[var(--sky)] font-medium' : 'text-[9px] text-[var(--sky)] font-medium'}> ATA</span>
                </div>
              )}
              {!destTiming.eta && !destTiming.ata && isLg && (
                <div>
                  <span className={dateLabelCls}>— </span>
                  <span className={dateLabelCls}>ETA</span>
                </div>
              )}
            </div>
          ) : <div />}
        </div>
      )}

      {/* Incoterm pill */}
      {incoterm && (
        <div className={`${isLg ? 'mt-4 pt-4' : 'mt-2 pt-2'} border-t border-[var(--border)] flex items-center gap-2`}>
          <span className="text-xs text-[var(--text-muted)]">Incoterm</span>
          <IncotermPill code={incoterm} />
          {onEditIncoterm && (
            <button
              onClick={onEditIncoterm}
              className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
              title="Edit incoterm"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
