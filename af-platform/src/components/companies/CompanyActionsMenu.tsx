'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pencil, Trash2, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { deleteCompanyAction } from '@/app/actions/companies';
import type { Company } from '@/lib/types';

interface CompanyActionsMenuProps {
  company: Company;
  onEdit: (company: Company) => void;
  onRefresh: () => void;
}

export function CompanyActionsMenu({ company, onEdit, onRefresh }: CompanyActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const result = await deleteCompanyAction(company.company_id);
    setLoading(false);
    if (result.success) {
      setShowConfirm(false);
      setOpen(false);
      onRefresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={() => {
            if (!open && buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
            }
            setOpen((v) => !v);
          }}
          className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {open && menuPos && (
          <div
            className="fixed z-50 w-40 bg-white rounded-xl border border-[var(--border)] shadow-lg py-1 text-sm"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <Link
              href={`/companies/${company.company_id}`}
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              View Details
            </Link>
            <button
              onClick={() => { onEdit(company); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <div className="my-1 border-t border-[var(--border)]" />
            <button
              onClick={() => { setShowConfirm(true); setOpen(false); setError(null); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>

            <h3 className="text-base font-semibold text-[var(--text)] mb-1">Delete company?</h3>
            <p className="text-sm text-[var(--text-muted)] mb-1">
              <span className="font-medium text-[var(--text)]">{company.name}</span>
              {' '}({company.company_id})
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              This will soft-delete the company (trash). It will no longer appear in lists but data is preserved.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
