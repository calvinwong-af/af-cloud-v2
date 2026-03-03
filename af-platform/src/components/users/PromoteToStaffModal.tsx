'use client';

import { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { promoteToStaffAction } from '@/app/actions/users';
import type { UserRecord } from '@/lib/users';

type StaffRole = 'AFU-ADMIN' | 'AFU-STAFF' | 'AFU-OPS';

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'AFU-ADMIN', label: 'AF Admin \u2014 Full system access' },
  { value: 'AFU-STAFF', label: 'AF Staff \u2014 Standard internal access' },
  { value: 'AFU-OPS', label: 'AF Operations \u2014 Operations-focused access' },
];

interface PromoteToStaffModalProps {
  user: UserRecord | null;
  onClose: () => void;
  onPromoted: () => void;
}

export function PromoteToStaffModal({ user, onClose, onPromoted }: PromoteToStaffModalProps) {
  const [role, setRole] = useState<StaffRole>('AFU-STAFF');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function handleConfirm() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const result = await promoteToStaffAction(user.uid, { role });
      if (!result) { setError('No response from server'); setSaving(false); return; }
      if (!result.success) { setError(result.error); setSaving(false); return; }
      onPromoted();
    } catch {
      setError('Failed to promote user. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,28,46,0.5)', backdropFilter: 'blur(2px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">Promote to Staff Account</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--text-muted)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">

          {/* Warning */}
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">This action promotes a customer account to internal staff.</p>
              <p className="mt-1 text-amber-700">
                <strong>{user.first_name} {user.last_name}</strong> ({user.email}) will gain access to
                the internal platform and their customer company association will be removed.
              </p>
            </div>
          </div>

          {/* Role selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)]">Staff Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent bg-white"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)]">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: 'var(--sky)' }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Promotion
          </button>
        </div>
      </div>
    </div>
  );
}
