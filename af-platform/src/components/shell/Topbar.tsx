"use client";

import { usePathname } from "next/navigation";
import type { User } from "firebase/auth";
import { Bell, Settings, Menu } from "lucide-react";
import { QuickSearch } from "./QuickSearch";

function getInitials(displayName: string | null): string {
  if (!displayName) return "U";
  return displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getSectionName(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0] || "dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

interface TopbarProps {
  currentUser: User;
  onMobileMenuOpen?: () => void;
}

export function Topbar({ currentUser, onMobileMenuOpen }: TopbarProps) {
  const pathname = usePathname();
  const sectionName = getSectionName(pathname);

  return (
    <header
      className="shrink-0 flex items-center justify-between px-4 sm:px-6 h-[56px]"
      style={{
        background: "white",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Left — Hamburger (mobile) + Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMobileMenuOpen}
          className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--surface)] -ml-1 mr-1"
          aria-label="Open menu"
        >
          <Menu size={18} style={{ color: "var(--text-mid)" }} />
        </button>

        <span style={{ color: "var(--text-muted)" }}>Platform</span>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <span className="font-semibold" style={{ color: "var(--text)" }}>
          {sectionName}
        </span>
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-3">
        {/* Search bar — hidden on mobile */}
        <div className="hidden sm:block">
          <QuickSearch />
        </div>

        {/* Notifications */}
        <button
          className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--surface)]"
          aria-label="Notifications"
        >
          <Bell size={16} style={{ color: "var(--text-mid)" }} />
          <div
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: "#ef4444" }}
          />
        </button>

        {/* Settings */}
        <button
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--surface)]"
          aria-label="Settings"
        >
          <Settings size={16} style={{ color: "var(--text-mid)" }} />
        </button>

        {/* User avatar */}
        <div
          className="flex items-center justify-center rounded-full text-white text-[0.65rem] font-semibold"
          style={{
            width: 32,
            height: 32,
            background: "linear-gradient(135deg, var(--sky), var(--sky-light))",
          }}
        >
          {getInitials(currentUser.displayName)}
        </div>
      </div>
    </header>
  );
}
