'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getCurrentUserProfileAction, type UserProfile } from '@/app/actions/users';
import { formatDate } from '@/lib/utils';

function resolveRoleLabel(accountType: string | null, role: string | null): string {
  if (accountType === 'AFU') {
    return role === 'AFU-ADMIN' ? 'AF Admin' : 'AF Staff';
  }
  if (accountType === 'AFC') {
    if (role === 'AFC-ADMIN') return 'Company Admin';
    if (role === 'AFC-M') return 'Company Manager';
  }
  return role ?? 'Staff';
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const f = firstName?.[0] ?? '';
  const l = lastName?.[0] ?? '';
  return (f + l).toUpperCase() || 'U';
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getCurrentUserProfileAction().then(setProfile);
  }, []);

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--sky)]" />
      </div>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || '—';
  const roleLabel = resolveRoleLabel(profile.account_type, profile.role);
  const isAfc = profile.account_type === 'AFC';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="shrink-0 flex items-center justify-center rounded-xl text-white text-lg font-semibold"
          style={{
            width: 56,
            height: 56,
            background: 'linear-gradient(135deg, var(--sky), var(--sky-light))',
          }}
        >
          {getInitials(profile.first_name, profile.last_name)}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[var(--text)]">{fullName}</h1>
          <p className="text-sm text-[var(--text-muted)]">{profile.email ?? '—'}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[var(--text-muted)]">{roleLabel}</span>
            <span
              className="text-[0.65rem] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: isAfc ? 'rgba(59,130,246,0.1)' : 'rgba(100,116,139,0.1)',
                color: isAfc ? '#3b82f6' : '#64748b',
              }}
            >
              {isAfc ? 'Customer' : 'Staff'}
            </span>
          </div>
        </div>
      </div>

      {/* Account Card */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider">Account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="Name" value={fullName} />
          <InfoRow label="Email" value={profile.email} />
          <InfoRow label="Phone" value={profile.phone_number} />
          <InfoRow label="Account Created" value={formatDate(profile.created_at)} />
          <InfoRow label="Last Login" value={formatDate(profile.last_login)} />
        </div>
      </div>

      {/* Access Card */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider">Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="Role" value={roleLabel} />
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)]">Status</p>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: profile.valid_access ? '#22c55e' : '#ef4444' }}
              />
              <span className="text-sm text-[var(--text)]">
                {profile.valid_access ? 'Active' : 'Restricted'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Company Card — AFC users only */}
      {isAfc && (
        <div className="bg-white rounded-xl border border-[var(--border)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider">Company</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="Company Name" value={profile.company_name} />
            <InfoRow label="Company ID" value={profile.company_id} mono />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className={`text-sm text-[var(--text)] ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}
