'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Pencil, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import type { Company } from '@/lib/types';
import {
  fetchHaulageSupplierRebatesAction,
  createHaulageSupplierRebateAction,
  updateHaulageSupplierRebateAction,
  deleteHaulageSupplierRebateAction,
  fetchHaulageFafRatesAction,
  createHaulageFafRateAction,
  updateHaulageFafRateAction,
  deleteHaulageFafRateAction,
  type HaulageSupplierRebate,
  type HaulageFafRate,
  type FafPortRate,
} from '@/app/actions/pricing';

interface SupplierPricingModalProps {
  company: Company;
  open: boolean;
  onClose: () => void;
}

const inputClass = "h-8 px-2 text-xs rounded border border-[var(--border)] bg-white text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--sky)] focus:border-[var(--sky)] w-full";

const CONTAINER_SIZES = [
  { value: '20', label: '20ft' },
  { value: '40', label: '40ft' },
  { value: '40HC', label: '40ft HC' },
  { value: 'side_loader_20', label: 'SL 20ft' },
  { value: 'side_loader_40', label: 'SL 40ft' },
  { value: 'side_loader_40HC', label: 'SL 40ft HC' },
];

const FAF_CONTAINER_SIZES = [
  { value: '20', label: '20ft' },
  { value: '40', label: '40ft' },
  { value: '40HC', label: '40ft HC' },
  { value: 'wildcard', label: 'All sizes' },
];

function containerSizeLabel(cs: string): string {
  const found = CONTAINER_SIZES.find(c => c.value === cs);
  return found?.label ?? cs;
}

function fafContainerSizeLabel(cs: string): string {
  if (cs === 'wildcard') return 'All sizes';
  const found = FAF_CONTAINER_SIZES.find(c => c.value === cs);
  return found?.label ?? cs;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PUBLISHED') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Published</span>;
  }
  if (status === 'DRAFT') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">Draft</span>;
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 border border-gray-200">{status}</span>;
}

function formatDate(d: string | null): string {
  if (!d) return '\u2014';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '\u2014';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================================================
// Rebates Tab
// ============================================================================

function RebatesTab({ supplierId }: { supplierId: string }) {
  const [rebates, setRebates] = useState<HaulageSupplierRebate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formContainerSize, setFormContainerSize] = useState('20');
  const [formRebatePercent, setFormRebatePercent] = useState('');
  const [formEffFrom, setFormEffFrom] = useState('');
  const [formEffTo, setFormEffTo] = useState('');
  const [formStatus, setFormStatus] = useState('PUBLISHED');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHaulageSupplierRebatesAction(supplierId);
      if (!result) { setError('No response'); return; }
      if (result.success) setRebates(result.data);
      else setError(result.error);
    } catch {
      setError('Failed to load rebates');
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditId(null);
    setFormContainerSize('20');
    setFormRebatePercent('');
    setFormEffFrom('');
    setFormEffTo('');
    setFormStatus('PUBLISHED');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (r: HaulageSupplierRebate) => {
    setEditId(r.id);
    setFormContainerSize(r.container_size);
    setFormRebatePercent((r.rebate_percent * 100).toFixed(2));
    setFormEffFrom(r.effective_from);
    setFormEffTo(r.effective_to ?? '');
    setFormStatus(r.rate_status);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const percentValue = parseFloat(formRebatePercent) / 100;
      if (isNaN(percentValue)) { setFormError('Invalid rebate percentage'); setSaving(false); return; }

      if (editId) {
        const result = await updateHaulageSupplierRebateAction(editId, {
          effective_to: formEffTo || null,
          rate_status: formStatus,
          rebate_percent: percentValue,
        });
        if (!result) { setFormError('No response'); setSaving(false); return; }
        if (!result.success) { setFormError(result.error); setSaving(false); return; }
      } else {
        const result = await createHaulageSupplierRebateAction({
          supplier_id: supplierId,
          container_size: formContainerSize,
          effective_from: formEffFrom,
          effective_to: formEffTo || null,
          rate_status: formStatus,
          rebate_percent: percentValue,
        });
        if (!result) { setFormError('No response'); setSaving(false); return; }
        if (!result.success) { setFormError(result.error); setSaving(false); return; }
      }
      setFormOpen(false);
      load();
    } catch {
      setFormError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      await deleteHaulageSupplierRebateAction(id);
      setConfirmDeleteId(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--sky)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
        {error}
        <button onClick={load} className="ml-3 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
          style={{ background: 'var(--sky)' }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Rebate
        </button>
      </div>

      {/* Inline form */}
      {formOpen && (
        <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--surface)] space-y-3">
          <h4 className="text-xs font-semibold text-[var(--text)]">{editId ? 'Edit Rebate' : 'Add Rebate'}</h4>
          {formError && (
            <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{formError}</div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Container Size</label>
              <select value={formContainerSize} onChange={e => setFormContainerSize(e.target.value)} className={inputClass} disabled={!!editId}>
                {CONTAINER_SIZES.map(cs => <option key={cs.value} value={cs.value}>{cs.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Rebate %</label>
              <input type="number" step="0.01" value={formRebatePercent} onChange={e => setFormRebatePercent(e.target.value)} className={inputClass} placeholder="e.g. 7.50" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Status</label>
              <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className={inputClass}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Effective From</label>
              <input type="date" value={formEffFrom} onChange={e => setFormEffFrom(e.target.value)} className={inputClass} disabled={!!editId} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Effective To</label>
              <input type="date" value={formEffTo} onChange={e => setFormEffTo(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || (!editId && (!formEffFrom || !formRebatePercent))}
              className="px-4 py-1.5 text-xs rounded-lg text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ background: 'var(--sky)' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setFormOpen(false)}
              className="px-4 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {rebates.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">No rebates configured</div>
      ) : (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] uppercase tracking-wide">Container Size</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] uppercase tracking-wide">Rebate %</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] uppercase tracking-wide">From</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] uppercase tracking-wide">To</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                <th className="px-3 py-2 text-right font-medium text-[var(--text-muted)] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rebates.map(r => (
                <tr key={r.id} className="hover:bg-[var(--surface)] transition-colors">
                  <td className="px-3 py-2 font-medium">{containerSizeLabel(r.container_size)}</td>
                  <td className="px-3 py-2">{(r.rebate_percent * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{formatDate(r.effective_from)}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{formatDate(r.effective_to)}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.rate_status} /></td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(r)} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {confirmDeleteId === r.id ? (
                        <span className="text-[10px] text-red-600 flex items-center gap-1">
                          Sure?
                          <button onClick={() => handleDelete(r.id)} className="text-red-600 underline" disabled={deleting}>Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="underline">No</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(r.id)} className="p-1 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FAF Tab
// ============================================================================

interface FafFormPortRate {
  port_un_code: string;
  container_size: string;
  faf_percent: string; // stored as string in form, converted on save
}

function FafTab({ supplierId }: { supplierId: string }) {
  const [fafRates, setFafRates] = useState<HaulageFafRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formEffFrom, setFormEffFrom] = useState('');
  const [formEffTo, setFormEffTo] = useState('');
  const [formStatus, setFormStatus] = useState('DRAFT');
  const [formPortRates, setFormPortRates] = useState<FafFormPortRate[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHaulageFafRatesAction(supplierId);
      if (!result) { setError('No response'); return; }
      if (result.success) setFafRates(result.data);
      else setError(result.error);
    } catch {
      setError('Failed to load FAF rates');
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditId(null);
    setFormEffFrom('');
    setFormEffTo('');
    setFormStatus('DRAFT');
    setFormPortRates([{ port_un_code: '', container_size: 'wildcard', faf_percent: '' }]);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (r: HaulageFafRate) => {
    setEditId(r.id);
    setFormEffFrom(r.effective_from);
    setFormEffTo(r.effective_to ?? '');
    setFormStatus(r.rate_status);
    setFormPortRates(r.port_rates.map(pr => ({
      port_un_code: pr.port_un_code,
      container_size: pr.container_size,
      faf_percent: (pr.faf_percent * 100).toFixed(2),
    })));
    setFormError(null);
    setFormOpen(true);
  };

  const addPortRate = () => {
    setFormPortRates(prev => [...prev, { port_un_code: '', container_size: 'wildcard', faf_percent: '' }]);
  };

  const removePortRate = (idx: number) => {
    setFormPortRates(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePortRate = (idx: number, field: keyof FafFormPortRate, value: string) => {
    setFormPortRates(prev => prev.map((pr, i) => i === idx ? { ...pr, [field]: value } : pr));
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      // Validate port rates
      if (formPortRates.length === 0) { setFormError('At least one port rate entry is required'); setSaving(false); return; }

      const portRates: FafPortRate[] = formPortRates.map(pr => ({
        port_un_code: pr.port_un_code.trim().toUpperCase(),
        container_size: pr.container_size,
        faf_percent: parseFloat(pr.faf_percent) / 100,
      }));

      const invalid = portRates.some(pr => !pr.port_un_code || isNaN(pr.faf_percent));
      if (invalid) { setFormError('All port rate entries must have a port code and valid FAF %'); setSaving(false); return; }

      if (editId) {
        const result = await updateHaulageFafRateAction(editId, {
          effective_to: formEffTo || null,
          rate_status: formStatus,
          port_rates: portRates,
        });
        if (!result) { setFormError('No response'); setSaving(false); return; }
        if (!result.success) { setFormError(result.error); setSaving(false); return; }
      } else {
        const result = await createHaulageFafRateAction({
          supplier_id: supplierId,
          effective_from: formEffFrom,
          effective_to: formEffTo || null,
          rate_status: formStatus,
          port_rates: portRates,
        });
        if (!result) { setFormError('No response'); setSaving(false); return; }
        if (!result.success) { setFormError(result.error); setSaving(false); return; }
      }
      setFormOpen(false);
      load();
    } catch {
      setFormError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      await deleteHaulageFafRateAction(id);
      setConfirmDeleteId(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--sky)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
        {error}
        <button onClick={load} className="ml-3 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
          style={{ background: 'var(--sky)' }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add FAF Rate
        </button>
      </div>

      {/* Inline form */}
      {formOpen && (
        <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--surface)] space-y-3">
          <h4 className="text-xs font-semibold text-[var(--text)]">{editId ? 'Edit FAF Rate' : 'Add FAF Rate'}</h4>
          {formError && (
            <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{formError}</div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Effective From</label>
              <input type="date" value={formEffFrom} onChange={e => setFormEffFrom(e.target.value)} className={inputClass} disabled={!!editId} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Effective To</label>
              <input type="date" value={formEffTo} onChange={e => setFormEffTo(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Status</label>
              <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className={inputClass}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          {/* Port rates builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Port Rates</label>
              <button
                onClick={addPortRate}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-dashed border-[var(--sky)]/50 text-[var(--sky)] hover:bg-white/50 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Port
              </button>
            </div>
            {formPortRates.map((pr, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                <div>
                  {idx === 0 && <label className="block text-[10px] text-[var(--text-muted)] mb-1">Port UN Code</label>}
                  <input
                    type="text"
                    value={pr.port_un_code}
                    onChange={e => updatePortRate(idx, 'port_un_code', e.target.value)}
                    className={inputClass}
                    placeholder="e.g. MYPKG"
                  />
                </div>
                <div>
                  {idx === 0 && <label className="block text-[10px] text-[var(--text-muted)] mb-1">Container Size</label>}
                  <select value={pr.container_size} onChange={e => updatePortRate(idx, 'container_size', e.target.value)} className={inputClass}>
                    {FAF_CONTAINER_SIZES.map(cs => <option key={cs.value} value={cs.value}>{cs.label}</option>)}
                  </select>
                </div>
                <div>
                  {idx === 0 && <label className="block text-[10px] text-[var(--text-muted)] mb-1">FAF %</label>}
                  <input
                    type="number"
                    step="0.01"
                    value={pr.faf_percent}
                    onChange={e => updatePortRate(idx, 'faf_percent', e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 5.00"
                  />
                </div>
                <button
                  onClick={() => removePortRate(idx)}
                  className="p-1.5 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || (!editId && !formEffFrom) || formPortRates.length === 0}
              className="px-4 py-1.5 text-xs rounded-lg text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ background: 'var(--sky)' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setFormOpen(false)}
              className="px-4 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {fafRates.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">No FAF rates configured</div>
      ) : (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] uppercase tracking-wide w-6"></th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] uppercase tracking-wide">From</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] uppercase tracking-wide">To</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] uppercase tracking-wide">Ports</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] uppercase tracking-wide">Entries</th>
                <th className="px-3 py-2 text-right font-medium text-[var(--text-muted)] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {fafRates.map(r => {
                const isExpanded = expandedId === r.id;
                const distinctPorts = new Set(r.port_rates.map(pr => pr.port_un_code)).size;
                return (
                  <React.Fragment key={r.id}>
                    <tr
                      className="hover:bg-[var(--surface)] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    >
                      <td className="px-3 py-2 text-[var(--text-muted)]">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{formatDate(r.effective_from)}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{formatDate(r.effective_to)}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.rate_status} /></td>
                      <td className="px-3 py-2">{distinctPorts} port{distinctPorts !== 1 ? 's' : ''}</td>
                      <td className="px-3 py-2">{r.port_rates.length} entr{r.port_rates.length !== 1 ? 'ies' : 'y'}</td>
                      <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(r)} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === r.id ? (
                            <span className="text-[10px] text-red-600 flex items-center gap-1">
                              Sure?
                              <button onClick={() => handleDelete(r.id)} className="text-red-600 underline" disabled={deleting}>Yes</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="underline">No</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(r.id)} className="p-1 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && r.port_rates.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-8 py-2 bg-slate-50/50">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[var(--text-muted)]">
                                <th className="px-2 py-1 text-left font-medium">Port</th>
                                <th className="px-2 py-1 text-left font-medium">Container Size</th>
                                <th className="px-2 py-1 text-left font-medium">FAF %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.port_rates.map((pr, idx) => (
                                <tr key={idx} className="border-t border-[var(--border)]/30">
                                  <td className="px-2 py-1 font-mono">{pr.port_un_code}</td>
                                  <td className="px-2 py-1">{fafContainerSizeLabel(pr.container_size)}</td>
                                  <td className="px-2 py-1">{(pr.faf_percent * 100).toFixed(2)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Modal
// ============================================================================

import React from 'react';

export function SupplierPricingModal({ company, open, onClose }: SupplierPricingModalProps) {
  const [activeTab, setActiveTab] = useState<'rebates' | 'faf'>('rebates');

  if (!open) return null;

  const tabClass = (tab: 'rebates' | 'faf') =>
    `px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-[var(--sky)] text-[var(--sky)]'
        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Supplier Pricing</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-[var(--text-muted)]">{company.name}</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]">
                {company.company_id}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)] shrink-0">
          <button className={tabClass('rebates')} onClick={() => setActiveTab('rebates')}>Rebates</button>
          <button className={tabClass('faf')} onClick={() => setActiveTab('faf')}>FAF</button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'rebates' && <RebatesTab supplierId={company.company_id} />}
          {activeTab === 'faf' && <FafTab supplierId={company.company_id} />}
        </div>
      </div>
    </div>
  );
}
