'use client';

import { useState } from 'react';
import { CheckCircle, AlertTriangle, Link2, X, Search } from 'lucide-react';
import { BLManualFields } from './BLManualFields';
import { BLContainerTable, type BLContainer } from './BLContainerTable';
import type { BLFormState } from './BLManualFields';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Port {
  un_code: string;
  name: string;
  country: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
}

interface CompanyMatch {
  company_id: string;
  name: string;
  score: number;
}

interface Company {
  company_id: string;
  name: string;
}

interface ParseBLResult {
  parsed: {
    waybill_number: string | null;
    booking_number: string | null;
    carrier_agent: string | null;
    carrier: string | null;
    vessel_name: string | null;
    voyage_number: string | null;
    port_of_loading: string | null;
    port_of_discharge: string | null;
    on_board_date: string | null;
    freight_terms: string | null;
    shipper_name: string | null;
    shipper_address: string | null;
    consignee_name: string | null;
    consignee_address: string | null;
    notify_party_name: string | null;
    cargo_description: string | null;
    total_weight_kg: number | null;
    total_packages: string | null;
    delivery_status: string | null;
    containers: BLContainer[];
    awb_type?: string | null;
    hawb_number?: string | null;
    mawb_number?: string | null;
    origin_iata?: string | null;
    dest_iata?: string | null;
    flight_number?: string | null;
    flight_date?: string | null;
    pieces?: number | null;
    gross_weight_kg?: number | null;
    chargeable_weight_kg?: number | null;
    notify_party?: string | null;
  };
  order_type: string;
  doc_type?: string;
  origin_un_code: string | null;
  origin_parsed_label: string | null;
  destination_un_code: string | null;
  destination_parsed_label: string | null;
  initial_status: number;
  company_matches: CompanyMatch[];
}

interface BLParseResultProps {
  formState: BLFormState;
  setFormState: (s: BLFormState) => void;
  companyMatches: CompanyMatch[];
  ports: Port[];
  isSubmitting: boolean;
  submitError: string | null;
  parsedResult: ParseBLResult | null;
  companies?: Company[];
  onConfirmReady: (ready: boolean) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  BL: 'Bill of Lading',
  BOOKING_CONFIRMATION: 'Booking Confirmation',
  AWB: 'Air Waybill',
  UNKNOWN: 'Unknown Document',
};

const STATUS_LABELS: Record<number, string> = {
  3001: 'Booking Pending',
  3002: 'Booking Confirmed',
  4001: 'Departed',
  4002: 'Arrived',
};

// ─── Small helpers ───────────────────────────────────────────────────────────

const inputBase = 'w-full px-3 py-2 text-sm border rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-[var(--text-mid)] mb-2">{children}</p>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--sky-pale)] text-[var(--sky)]">
      {children}
    </span>
  );
}

// ─── Company match / search section ──────────────────────────────────────────

interface CompanyMatchSectionProps {
  matches: CompanyMatch[];
  formState: BLFormState;
  showCompanySearch: boolean;
  companySearch: string;
  companySearchResults: Array<{ company_id: string; name: string }>;
  onShowSearch: () => void;
  onHideSearch: () => void;
  onSearchChange: (v: string) => void;
  onLink: (id: string) => void;
  onUnlink: () => void;
  update: (partial: Partial<BLFormState>) => void;
}

function CompanyMatchSection({
  matches, formState, showCompanySearch, companySearch, companySearchResults,
  onShowSearch, onHideSearch, onSearchChange, onLink, onUnlink, update,
}: CompanyMatchSectionProps) {
  const inputBaseCms = 'w-full px-3 py-2 text-sm border rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent';

  if (formState.linkedCompanyId) {
    const linkedName = matches.find(m => m.company_id === formState.linkedCompanyId)?.name;
    return (
      <div className="mt-2 flex items-center justify-between border border-emerald-300 bg-emerald-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-emerald-800">{linkedName ?? formState.linkedCompanyId}</p>
            <p className="text-xs text-emerald-600">{formState.linkedCompanyId}</p>
          </div>
        </div>
        <button onClick={onUnlink} className="text-emerald-400 hover:text-emerald-600"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  if (showCompanySearch) {
    return (
      <div className="mt-2 border border-[var(--border)] rounded-lg p-3 bg-[var(--surface)] space-y-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-[var(--text-mid)]">Customer / Shipment Owner</p>
          <button onClick={onHideSearch} className="text-[var(--text-muted)] hover:text-[var(--text)]"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            autoFocus
            type="text"
            value={companySearch}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search by name or company ID..."
            className={`${inputBaseCms} pl-8 text-xs`}
          />
        </div>
        {companySearchResults.length > 0 && (
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            {companySearchResults.map(c => (
              <button
                key={c.company_id}
                onClick={() => onLink(c.company_id)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--sky-mist)] border-b border-[var(--border)] last:border-0"
              >
                <div>
                  <p className="text-xs font-medium text-[var(--text)]">{c.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{c.company_id}</p>
                </div>
                <Link2 className="w-3 h-3 text-[var(--sky)] flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
        {companySearch && companySearchResults.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-1">No matches found</p>
        )}
        <button
          onClick={() => { update({ linkedCompanyId: null, companyMatchDismissed: true }); onHideSearch(); }}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] w-full text-center py-1"
        >
          Skip — assign company later
        </button>
      </div>
    );
  }

  if (matches.length > 0 && !formState.companyMatchDismissed) {
    return (
      <div className="mt-2 border border-[var(--border)] rounded-lg p-3 bg-[var(--surface)]">
        <p className="text-xs text-[var(--text-muted)] mb-2">Possible match found:</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">{matches[0].name}</p>
            <p className="text-xs text-[var(--text-muted)]">{matches[0].company_id}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onLink(matches[0].company_id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--sky)] border border-[var(--sky)] rounded-lg hover:bg-[var(--sky-mist)] transition-colors"
            >
              <Link2 className="w-3 h-3" />
              Link to {matches[0].company_id}
            </button>
            <button
              onClick={onShowSearch}
              className="px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Not this company
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BLParseResult({
  formState,
  setFormState,
  companyMatches,
  ports,
  isSubmitting,
  submitError,
  parsedResult,
  companies = [],
  onConfirmReady,
}: BLParseResultProps) {
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [companyBannerSkipped, setCompanyBannerSkipped] = useState(false);

  const update = (partial: Partial<BLFormState>) => {
    const next = { ...formState, ...partial };
    setFormState(next);
    const hasOrigin = !!next.originCode;
    const hasDest = !!next.destCode;
    onConfirmReady(hasOrigin && hasDest);
  };

  const matches = companyMatches;
  const companySearchResults = companySearch.trim().length > 0
    ? (companies.length > 0
        ? companies.filter(c =>
            c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
            c.company_id.toLowerCase().includes(companySearch.toLowerCase())
          ).slice(0, 5)
        : matches.filter(m =>
            m.name.toLowerCase().includes(companySearch.toLowerCase()) ||
            m.company_id.toLowerCase().includes(companySearch.toLowerCase())
          )
      )
    : matches.slice(0, 5);

  const parsed = parsedResult?.parsed;
  const isPrepaid = (parsed?.freight_terms ?? '').toUpperCase().includes('PREPAID');
  const initialStatus = parsedResult?.initial_status ?? 3001;
  const isBookingConfirmation = parsedResult?.doc_type === 'BOOKING_CONFIRMATION';
  const isAWB = parsedResult?.doc_type === 'AWB';
  const effectiveStatus = (initialStatus >= 4001 && isBookingConfirmation)
    ? 3002
    : initialStatus;
  const orderType = parsedResult?.order_type ?? 'SEA_FCL';
  const containers = parsed?.containers ?? [];

  const docTypeBadge = parsedResult?.doc_type && parsedResult.doc_type !== 'UNKNOWN' ? (
    <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
      parsedResult.doc_type === 'BOOKING_CONFIRMATION'
        ? 'bg-teal-100 text-teal-700'
        : parsedResult.doc_type === 'AWB'
        ? 'bg-sky-100 text-sky-700'
        : 'bg-blue-100 text-blue-700'
    }`}>
      {DOC_TYPE_LABELS[parsedResult.doc_type] ?? parsedResult.doc_type}
    </span>
  ) : null;

  // Editable containers state (allows user to edit parsed container data)
  const [editableContainers, setEditableContainers] = useState<BLContainer[]>(
    containers.length > 0 ? containers : []
  );

  return (
    <div className="space-y-4">
      {/* Success banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        <span>Document parsed successfully — review extracted details below</span>
        {docTypeBadge}
      </div>

      {/* Company assignment — State C amber banner */}
      {!formState.linkedCompanyId && !companyBannerSkipped && (matches.length === 0 || formState.companyMatchDismissed) && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-800">Customer / Shipment Owner</p>
          </div>
          <p className="text-xs text-amber-700">No company match found. Assign an owner to this shipment:</p>
          {showCompanySearch ? (
            <div className="space-y-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                <input
                  autoFocus
                  type="text"
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  placeholder="Search by name or company ID..."
                  className={`${inputBase} pl-8 text-xs`}
                />
              </div>
              {companySearchResults.length > 0 && (
                <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-white">
                  {companySearchResults.map(c => (
                    <button
                      key={c.company_id}
                      onClick={() => {
                        const s = { ...formState, linkedCompanyId: c.company_id, companyMatchDismissed: false };
                        setFormState(s);
                        onConfirmReady(!!s.originCode && !!s.destCode);
                        setShowCompanySearch(false);
                        setCompanySearch('');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--sky-mist)] border-b border-[var(--border)] last:border-0"
                    >
                      <div>
                        <p className="text-xs font-medium text-[var(--text)]">{c.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{c.company_id}</p>
                      </div>
                      <Link2 className="w-3 h-3 text-[var(--sky)] flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {companySearch && companySearchResults.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-1">No matches found</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => { setShowCompanySearch(true); setCompanySearch(''); }}
              className={`${inputBase} text-left text-xs text-[var(--text-muted)] flex items-center gap-2`}
            >
              <Search className="w-3.5 h-3.5" />
              Search companies...
            </button>
          )}
          <button
            onClick={() => { setCompanyBannerSkipped(true); setShowCompanySearch(false); }}
            className="text-xs text-amber-600 hover:text-amber-800 w-full text-center py-0.5"
          >
            Skip — assign later
          </button>
        </div>
      )}

      {/* Prepaid hint (sea only) */}
      {!isAWB && isPrepaid && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Freight marked as Prepaid — incoterm defaulted to CNF (IMPORT). Adjustable after creation.</span>
        </div>
      )}

      {/* Manual fields (order type, route, carrier, parties, cargo) */}
      <BLManualFields
        formState={formState}
        onChange={partial => update(partial)}
        ports={ports}
        notifyPartyNameFromParsed={parsed?.notify_party_name}
      />

      {/* Company match section — rendered below consignee in sea form */}
      <div>
        <CompanyMatchSection
          matches={matches}
          formState={formState}
          showCompanySearch={showCompanySearch}
          companySearch={companySearch}
          companySearchResults={companySearchResults}
          onShowSearch={() => { setShowCompanySearch(true); setCompanySearch(''); }}
          onHideSearch={() => setShowCompanySearch(false)}
          onSearchChange={setCompanySearch}
          onLink={(id) => {
            const s = { ...formState, linkedCompanyId: id, companyMatchDismissed: false };
            setFormState(s);
            onConfirmReady(!!s.originCode && !!s.destCode);
            setShowCompanySearch(false);
          }}
          onUnlink={() => update({ linkedCompanyId: null })}
          update={update}
        />
      </div>

      {/* Containers (SEA_FCL) */}
      {orderType === 'SEA_FCL' && editableContainers.length > 0 && (
        <div>
          <SectionLabel>Containers</SectionLabel>
          <BLContainerTable
            containers={editableContainers}
            onChange={setEditableContainers}
          />
        </div>
      )}

      {/* Initial Status */}
      {!isAWB && (
        <div>
          <SectionLabel>Initial Status</SectionLabel>
          <div className="flex items-center gap-2">
            <Badge>{effectiveStatus} {STATUS_LABELS[effectiveStatus] ?? 'Unknown'}</Badge>
            {formState.etd && (
              <span className="text-xs text-[var(--text-muted)]">
                — vessel {effectiveStatus >= 4001 ? 'departed' : 'departs'} {new Date(formState.etd).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          {submitError}
        </div>
      )}

      {isSubmitting && (
        <div className="text-xs text-[var(--text-muted)] text-center py-2">Creating shipment…</div>
      )}
    </div>
  );
}
