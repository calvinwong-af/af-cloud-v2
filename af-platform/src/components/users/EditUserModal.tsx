/**
 * EditUserModal — af-platform
 *
 * Allows AFU-ADMIN to edit user details, change role,
 * reactivate a deactivated account, and reset password.
 *
 * NOTE on role naming: AFU = AF internal staff, AFC = customer.
 * Counterintuitive naming inherited from old system — do not change.
 */
'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Eye, EyeOff, RefreshCw, ShieldCheck } from 'lucide-react';
import { updateUserAction, resetPasswordAction, reactivateUserAction } from '@/app/actions/users';
import { fetchCompaniesAction } from '@/app/actions/companies';
import type { UserRecord } from '@/lib/users';
import type { Company } from '@/lib/types';

const AFU_ROLES = ['AFU-ADMIN'] as const;
const AFC_ROLES = ['AFC-ADMIN', 'AFC-M'] as const;

interface EditUserModalProps {
  user: UserRecord | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditUserModal({ user, onClose, onUpdated }: EditUserModalProps) {
  const [tab, setTab] = useState<'details' | 'password'>('details');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [companyId, setCompanyId] = useState<string>('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
      setPhone(user.phone_number ?? '');
      setRole(user.role ?? '');
      setCompanyId(user.company_id ?? '');
      setTab('details');
      setError(null);
      setSuccess(null);
      setNewPassword('');
      setConfirmPassword('');

      // Load company list for AFC users
      if (user.account_type === 'AFC') {
        setLoadingCompanies(true);
        fetchCompaniesAction().then((result) => {
          if (result.success) setCompanies(result.data);
          setLoadingCompanies(false);
        });
      }
    }
  }, [user]);

  if (!user) return null;

  const roleOptions = user.account_type === 'AFU' ? AFU_ROLES : AFC_ROLES;
  const isDeactivated = !user.valid_access;

  async function handleSaveDetails() {
    if (!firstName.trim()) { setError('First name is required'); return; }
    if (!lastName.trim()) { setError('Last name is required'); return; }
    if (!role) { setError('Role is required'); return; }
    setSaving(true); setError(null); setSuccess(null);
    const result = await updateUserAction(user.uid, {
      first_name: firstName,
      last_name: lastName,
      phone_number: phone,
      role,
      ...(user.account_type === 'AFC' && { company_id: companyId }),
    });
    setSaving(false);
    if (!result.success) { setError(result.error); }
    else { setSuccess('User updated successfully.'); setTimeout(onUpdated, 900); }
  }

  async function handleReactivate() {
    setSaving(true); setError(null); setSuccess(null);
    const result = await reactivateUserAction(user.uid);
    setSaving(false);
    if (!result.success) { setError(result.error); }
    else { setSuccess('Account reactivated.'); setTimeout(onUpdated, 900); }
  }

  async function handleResetPassword() {
    if (!newPassword) { setError('Enter a new password'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setSaving(true); setError(null); setSuccess(null);
    const result = await resetPasswordAction(user.uid, newPassword);
    setSaving(false);
    if (!result.success) { setError(result.error); }
    else { setSuccess('Password reset successfully.'); setNewPassword(''); setConfirmPassword(''); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,28,46,0.5)', backdropFilter: 'blur(2px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Edit User</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{user.first_name} {user.last_name} · {user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--text-muted)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Deactivated banner */}
        {isDeactivated && (
          <div className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-700 text-sm">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>This account is deactivated.</span>
            </div>
            <button onClick={handleReactivate} disabled={saving}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Reactivate
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mx-6 mt-4 rounded-lg bg-[var(--surface)] p-1 w-fit">
          {(['details', 'password'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setError(null); setSuccess(null); }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors capitalize
                ${tab === t ? 'bg-white text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-mid)]'}`}>
              {t === 'details' ? 'Details' : 'Password'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {tab === 'details' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-muted)]">First Name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="off"
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-muted)]">Last Name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                    autoComplete="off"
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-muted)]">Phone Number</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +60 12 345 6789"
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent placeholder:text-[var(--text-muted)]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Role <span className="font-normal">({user.account_type === 'AFU' ? 'AF Staff' : 'Customer'})</span>
                </label>
                <select value={role} onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent bg-white">
                  <option value="">Select role…</option>
                  {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {user.account_type === 'AFC' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-muted)]">Company</label>
                  {loadingCompanies ? (
                    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading companies…
                    </div>
                  ) : (
                    <select
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent bg-white"
                    >
                      <option value="">No company assigned</option>
                      {companies.map((c) => (
                        <option key={c.company_id} value={c.company_id}>
                          {c.name} ({c.company_id})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div className="rounded-lg bg-[var(--surface)] px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Email</span>
                  <span className="text-[var(--text-mid)]">{user.email}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Account Type</span>
                  <span className="text-[var(--text-mid)]">{user.account_type === 'AFU' ? 'AF Staff' : 'Customer'}</span>
                </div>
                {user.company_name && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Company</span>
                    <span className="text-[var(--text-mid)]">{user.company_name}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'password' && (
            <>
              <p className="text-sm text-[var(--text-muted)]">Set a new password for this account. The user will need to use it on their next sign-in.</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-muted)]">New Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 pr-10 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent placeholder:text-[var(--text-muted)]" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-mid)]">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-muted)]">Confirm Password</label>
                <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent" />
              </div>
            </>
          )}

          {/* Feedback */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{success}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)]">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-white transition-colors">
            Cancel
          </button>
          <button
            onClick={tab === 'details' ? handleSaveDetails : handleResetPassword}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: 'var(--sky)' }}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {tab === 'details' ? 'Save Changes' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
