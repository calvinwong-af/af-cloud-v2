'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';
import { createUserAction, type CreateUserInput } from '@/app/actions/users';
import { fetchCompaniesAction } from '@/app/actions/companies';
import type { Company } from '@/lib/types';

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const ROLES_AFU = ['AFU-ADMIN'];
const ROLES_AFC = ['AFC-ADMIN', 'AFC-M'];

export function CreateUserModal({ open, onClose, onCreated }: CreateUserModalProps) {
  const [form, setForm] = useState<CreateUserInput>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    account_type: 'AFU',
    role: 'AFU-ADMIN',
    company_id: null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Load companies when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingCompanies(true);
    fetchCompaniesAction({ limit: 700 })
      .then((res) => { if (res.success) setCompanies(res.data); })
      .finally(() => setLoadingCompanies(false));
  }, [open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setForm({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        phone_number: '',
        account_type: 'AFU',
        role: 'AFU-ADMIN',
        company_id: null,
      });
      setError(null);
      setShowPassword(false);
    }
  }, [open]);

  function handleAccountTypeChange(type: 'AFU' | 'AFC') {
    setForm((f) => ({
      ...f,
      account_type: type,
      role: type === 'AFU' ? 'AFU-ADMIN' : 'AFC-ADMIN',
      company_id: null,
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await createUserAction(form);
    setSubmitting(false);
    if (result.success) {
      onCreated();
      onClose();
    } else {
      setError(result.error);
    }
  }

  if (!open) return null;

  const roles = form.account_type === 'AFU' ? ROLES_AFU : ROLES_AFC;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Create New User</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--text-muted)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Account type toggle */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Account Type
            </label>
            <div className="flex gap-2">
              {(['AFU', 'AFC'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleAccountTypeChange(type)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                    ${form.account_type === type
                      ? 'bg-[var(--sky)] text-white border-[var(--sky)]'
                      : 'bg-white text-[var(--text-mid)] border-[var(--border)] hover:border-[var(--sky)]'
                    }`}
                >
                  {type === 'AFU' ? 'AF Staff' : 'Customer'}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              {form.account_type === 'AFU'
                ? 'Internal AcceleFreight staff account'
                : 'Customer portal account — requires a linked company'}
            </p>
          </div>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name">
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                placeholder="John"
                className={inputClass}
              />
            </Field>
            <Field label="Last Name">
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                placeholder="Smith"
                className={inputClass}
              />
            </Field>
          </div>

          {/* Email */}
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="john@example.com"
              className={inputClass}
            />
          </Field>

          {/* Password */}
          <Field label="Password">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min. 8 characters"
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          {/* Phone */}
          <Field label="Phone Number (optional)">
            <input
              type="tel"
              value={form.phone_number}
              onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
              placeholder="+60 12 345 6789"
              className={inputClass}
            />
          </Field>

          {/* Role */}
          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className={inputClass}
            >
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>

          {/* Company — only for AFC (customer) accounts */}
          {form.account_type === 'AFC' && (
            <Field label="Company">
              {loadingCompanies ? (
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading companies…
                </div>
              ) : (
                <select
                  value={form.company_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value || null }))}
                  className={inputClass}
                >
                  <option value="">Select a company…</option>
                  {companies.map((c) => (
                    <option key={c.company_id} value={c.company_id}>
                      {c.short_name || c.name} ({c.company_id})
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

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
            {submitting ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helpers
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
