'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { updateCompanyAction } from '@/app/actions/companies';
import { CURRENCIES, COUNTRIES, SUGGESTED_TAGS } from '@/lib/company-constants';
import type { Company } from '@/lib/types';

interface EditCompanyModalProps {
  company: Company | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditCompanyModal({ company, onClose, onUpdated }: EditCompanyModalProps) {
  const [form, setForm] = useState({
    name: '',
    short_name: '',
    registration_number: '',
    preferred_currency: 'MYR',
    address: { line1: '', line2: '', city: '', state: '', postcode: '', country: 'Malaysia' },
    contact_info: { phone: '', email: '', website: '' },
    approved: false,
    allow_access: false,
    tags: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? '',
        short_name: company.short_name ?? '',
        registration_number: company.registration_number ?? '',
        preferred_currency: company.preferred_currency ?? 'MYR',
        address: {
          line1: company.address?.line1 ?? '',
          line2: company.address?.line2 ?? '',
          city: company.address?.city ?? '',
          state: company.address?.state ?? '',
          postcode: company.address?.postcode ?? '',
          country: company.address?.country ?? 'Malaysia',
        },
        contact_info: {
          phone: company.contact_info?.phone ?? '',
          email: company.contact_info?.email ?? '',
          website: company.contact_info?.website ?? '',
        },
        approved: company.approved,
        allow_access: company.allow_access,
        tags: company.tags ?? [],
      });
      setError(null);
      setCountrySearch('');
      setCountryOpen(false);
      setTagInput('');
    }
  }, [company]);

  async function handleSubmit() {
    if (!company) return;
    if (!form.name?.trim()) {
      setError('Company name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await updateCompanyAction(company.company_id, form);
    setSubmitting(false);
    if (result.success) {
      onUpdated();
    } else {
      setError(result.error);
    }
  }

  if (!company) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Edit Company</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--text-muted)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Read-only info */}
          <div className="flex gap-6 text-xs text-[var(--text-muted)]">
            <div>
              <span className="uppercase tracking-wide font-medium">ID</span>
              <p className="font-mono text-[var(--text-mid)] mt-0.5">{company.company_id}</p>
            </div>
            {company.created && (
              <div>
                <span className="uppercase tracking-wide font-medium">Created</span>
                <p className="text-[var(--text-mid)] mt-0.5">{new Date(company.created).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
            )}
          </div>

          {/* Name + Short Name */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company Name *">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Short Name">
              <input
                type="text"
                value={form.short_name}
                onChange={(e) => setForm((f) => ({ ...f, short_name: e.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Registration + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Registration Number">
              <input
                type="text"
                value={form.registration_number}
                onChange={(e) => setForm((f) => ({ ...f, registration_number: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Currency">
              <select
                value={form.preferred_currency}
                onChange={(e) => setForm((f) => ({ ...f, preferred_currency: e.target.value }))}
                className={inputClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Status toggles */}
          <div className="flex gap-4">
            <div className="flex items-center justify-between flex-1">
              <span className="text-sm text-[var(--text)]">Approved</span>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, approved: !f.approved }))}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  form.approved
                    ? 'bg-[var(--sky)] text-white'
                    : 'bg-[var(--border)] text-[var(--text-muted)]'
                }`}
              >
                {form.approved ? 'Yes' : 'No'}
              </button>
            </div>
            <div className="flex items-center justify-between flex-1">
              <span className="text-sm text-[var(--text)]">Portal Access</span>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, allow_access: !f.allow_access }))}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  form.allow_access
                    ? 'bg-[var(--sky)] text-white'
                    : 'bg-[var(--border)] text-[var(--text-muted)]'
                }`}
              >
                {form.allow_access ? 'Active' : 'None'}
              </button>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Address</p>
            <input
              type="text"
              value={form.address.line1}
              onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, line1: e.target.value } }))}
              placeholder="Address Line 1"
              className={inputClass}
            />
            <input
              type="text"
              value={form.address.line2}
              onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, line2: e.target.value } }))}
              placeholder="Address Line 2"
              className={inputClass}
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                value={form.address.city}
                onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, city: e.target.value } }))}
                placeholder="City"
                className={inputClass}
              />
              <input
                type="text"
                value={form.address.state}
                onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, state: e.target.value } }))}
                placeholder="State"
                className={inputClass}
              />
              <input
                type="text"
                value={form.address.postcode}
                onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, postcode: e.target.value } }))}
                placeholder="Postcode"
                className={inputClass}
              />
            </div>
            {/* Country dropdown */}
            <div
              className="relative"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setCountryOpen(false);
                  setCountrySearch('');
                }
              }}
            >
              <input
                type="text"
                value={countryOpen ? countrySearch : form.address.country}
                onChange={(e) => setCountrySearch(e.target.value)}
                onFocus={() => { setCountryOpen(true); setCountrySearch(''); }}
                placeholder="Country"
                className={inputClass}
              />
              {countryOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-[var(--border)] rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                  {COUNTRIES.filter((c) =>
                    !countrySearch || c.toLowerCase().includes(countrySearch.toLowerCase())
                  ).map((c) => (
                    <div
                      key={c}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((f) => ({ ...f, address: { ...f.address, country: c } }));
                        setCountryOpen(false);
                        setCountrySearch('');
                      }}
                      className={`py-2 px-3 text-sm cursor-pointer hover:bg-[var(--surface)] ${
                        form.address.country === c ? 'font-medium text-[var(--sky)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Contact Info</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="tel"
                value={form.contact_info.phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_info: { ...f.contact_info, phone: e.target.value } }))}
                placeholder="Phone"
                className={inputClass}
              />
              <input
                type="email"
                value={form.contact_info.email}
                onChange={(e) => setForm((f) => ({ ...f, contact_info: { ...f.contact_info, email: e.target.value } }))}
                placeholder="Email"
                className={inputClass}
              />
            </div>
            <input
              type="url"
              value={form.contact_info.website}
              onChange={(e) => setForm((f) => ({ ...f, contact_info: { ...f.contact_info, website: e.target.value } }))}
              placeholder="Website"
              className={inputClass}
            />
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Tags</p>

            {/* Tag input row */}
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const tag = tagInput.trim().toLowerCase();
                    if (tag && !form.tags.includes(tag) && form.tags.length < 10) {
                      setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
                      setTagInput('');
                    }
                  }
                }}
                placeholder="Add a tag…"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  const tag = tagInput.trim().toLowerCase();
                  if (tag && !form.tags.includes(tag) && form.tags.length < 10) {
                    setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
                    setTagInput('');
                  }
                }}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors whitespace-nowrap"
              >
                Add
              </button>
            </div>

            {/* Selected tags */}
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-[var(--slate)] text-white text-xs px-2 py-0.5 rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))}
                      className="text-white/70 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Suggested tags */}
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((tag) => {
                const selected = form.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (selected) {
                        setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
                      } else if (form.tags.length < 10) {
                        setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
                      }
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      selected
                        ? 'bg-[var(--sky-pale)] text-[var(--sky)] border-[var(--sky)]'
                        : 'bg-white text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-mid)]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 text-sm rounded-lg bg-[var(--sky)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent placeholder:text-[var(--text-muted)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
