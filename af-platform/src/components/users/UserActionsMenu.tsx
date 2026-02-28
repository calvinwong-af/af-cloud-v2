'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pencil, UserX, Trash2, Loader2, AlertTriangle, Mail, CheckCircle } from 'lucide-react';
import { deactivateUserAction, deleteUserAction, sendPasswordResetEmailAction } from '@/app/actions/users';
import type { UserRecord } from '@/lib/users';

interface UserActionsMenuProps {
  user: UserRecord;
  onRefresh: () => void;
  onEdit?: (user: UserRecord) => void;
}

type ConfirmMode = 'deactivate' | 'delete' | null;

export function UserActionsMenu({ user, onRefresh, onEdit }: UserActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetFeedback, setResetFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleConfirm() {
    if (!confirmMode) return;
    setLoading(true);
    setError(null);

    const result = confirmMode === 'deactivate'
      ? await deactivateUserAction(user.uid)
      : await deleteUserAction(user.uid);

    setLoading(false);

    if (result.success) {
      setConfirmMode(null);
      setOpen(false);
      onRefresh();
    } else {
      setError(result.error);
    }
  }

  async function handleSendResetEmail() {
    setSendingReset(true);
    setOpen(false);
    setResetFeedback(null);
    const result = await sendPasswordResetEmailAction(user.uid);
    setSendingReset(false);
    if (result.success) {
      setResetFeedback({ type: 'success', message: `Reset email sent to ${user.email}` });
    } else {
      setResetFeedback({ type: 'error', message: result.error ?? 'Failed to send reset email' });
    }
    setTimeout(() => setResetFeedback(null), 4000);
  }

  function handleAction(mode: ConfirmMode) {
    setConfirmMode(mode);
    setError(null);
    setOpen(false);
  }

  return (
    <>
      {/* Reset email feedback toast (inline, below the row trigger) */}
      {resetFeedback && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm shadow-lg border
          ${resetFeedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'}`}>
          {resetFeedback.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {resetFeedback.message}
        </div>
      )}

      {/* Spinner shown on the menu button while sending reset */}
      <div className="relative" ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={() => {
            if (!open && buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect();
              setMenuPos({
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
              });
            }
            setOpen((v) => !v);
          }}
          className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          {sendingReset
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <MoreVertical className="w-4 h-4" />}
        </button>

        {open && menuPos && (
          <div
            className="fixed z-50 w-48 bg-white rounded-xl border border-[var(--border)] shadow-lg py-1 text-sm"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {onEdit && (
              <>
                <button
                  onClick={() => { setOpen(false); onEdit(user); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
              </>
            )}
            <button
              onClick={handleSendResetEmail}
              disabled={sendingReset}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              Send Reset Email
            </button>
            <div className="my-1 border-t border-[var(--border)]" />
            <button
              onClick={() => handleAction('deactivate')}
              disabled={!user.valid_access}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserX className="w-4 h-4" />
              Deactivate
            </button>
            <div className="my-1 border-t border-[var(--border)]" />
            <button
              onClick={() => handleAction('delete')}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Permanently
            </button>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmMode(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4
              ${confirmMode === 'delete' ? 'bg-red-100' : 'bg-amber-100'}`}>
              <AlertTriangle className={`w-5 h-5 ${confirmMode === 'delete' ? 'text-red-600' : 'text-amber-600'}`} />
            </div>

            <h3 className="text-base font-semibold text-[var(--text)] mb-1">
              {confirmMode === 'delete' ? 'Permanently delete user?' : 'Deactivate user?'}
            </h3>

            <p className="text-sm text-[var(--text-muted)] mb-1">
              <span className="font-medium text-[var(--text)]">
                {user.first_name} {user.last_name}
              </span>
              {' '}({user.email})
            </p>

            <p className="text-sm text-[var(--text-muted)] mb-5">
              {confirmMode === 'delete'
                ? 'This will permanently remove the Firebase Auth account and all associated Datastore records. This cannot be undone.'
                : 'This will disable login access. The account and all data will be preserved and can be reactivated later.'}
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmMode(null)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`flex-1 px-4 py-2 text-sm rounded-lg text-white font-medium transition-opacity disabled:opacity-50 flex items-center justify-center gap-2
                  ${confirmMode === 'delete' ? 'bg-red-600 hover:opacity-90' : 'bg-amber-500 hover:opacity-90'}`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Processing...' : confirmMode === 'delete' ? 'Delete' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
