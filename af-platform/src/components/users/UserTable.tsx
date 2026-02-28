"use client";

import { AlertTriangle } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { UserRecord } from "@/lib/users";
import { UserActionsMenu } from './UserActionsMenu';

interface UserTableProps {
  users: UserRecord[];
  loading: boolean;
  onRefresh: () => void;
  onEdit: (user: UserRecord) => void;
}

// 7 columns — down from 9
// Phone removed (in Edit modal), Email merged under Name, Role moved to Type tooltip
const COLUMNS = ["Name", "Type", "Company", "Validated", "Access", "Created", "Actions"];

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className={cn("px-4 py-3", i === 6 && "sticky right-0 bg-white border-l border-[var(--border)]")}>
          <div className="h-4 rounded bg-[var(--surface)] animate-pulse" style={{ width: i === 0 ? "60%" : "40%" }} />
        </td>
      ))}
    </tr>
  );
}

export function UserTable({ users, loading, onRefresh, onEdit }: UserTableProps) {
  if (!loading && users.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[var(--border)] py-16 text-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No users found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--border)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                    col === "Actions" && "sticky right-0 z-10 bg-white border-l border-[var(--border)]"
                  )}
                  style={{ color: "var(--text-muted)" }}
                >
                  {col === "Actions" ? <span className="sr-only">Actions</span> : col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : users.map((user) => (
                  <tr key={user.uid} className="group hover:bg-[var(--surface)] transition-colors">

                    {/* Name + email */}
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--text)" }}>
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {user.email}
                      </div>
                    </td>

                    {/* Type pill — role shown as native tooltip on hover */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        title={user.role ?? undefined}
                        className={cn(
                          "rounded-full text-xs font-medium px-2 py-0.5 cursor-default",
                          user.account_type === "AFU"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-green-100 text-green-700"
                        )}
                      >
                        {user.account_type}
                      </span>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {user.company_id ? (
                        <div>
                          <div style={{ color: "var(--text-mid)" }}>
                            {user.company_name ?? user.company_id}
                          </div>
                          <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                            {user.company_id}
                          </div>
                        </div>
                      ) : user.account_type === "AFC" ? (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <AlertTriangle size={14} />
                          <span className="text-xs font-medium">Missing link</span>
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>

                    {/* Validated dot */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-block h-2.5 w-2.5 rounded-full",
                          user.validated ? "bg-green-500" : "bg-gray-300"
                        )}
                      />
                    </td>

                    {/* Access pill */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "rounded-full text-xs font-medium px-2 py-0.5",
                          user.valid_access
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {user.valid_access ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatDate(user.created_at)}
                    </td>

                    {/* Actions — sticky right */}
                    <td className="sticky right-0 z-10 bg-white group-hover:bg-[var(--surface)] transition-colors border-l border-[var(--border)] px-4 py-3 text-center">
                      <UserActionsMenu user={user} onRefresh={onRefresh} onEdit={onEdit} />
                    </td>

                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
