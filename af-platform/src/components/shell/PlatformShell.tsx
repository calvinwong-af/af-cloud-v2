"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface PlatformShellProps {
  currentUser: User;
  children: React.ReactNode;
}

export function PlatformShell({ currentUser, children }: PlatformShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen flex flex-row overflow-hidden">
      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop: normal flow; mobile: fixed drawer */}
      <div
        className={`
          fixed inset-y-0 left-0 z-[201] w-[240px]
          transform transition-transform duration-250 ease-in-out
          lg:relative lg:transform-none lg:w-auto lg:z-auto
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <Sidebar
          currentUser={currentUser}
          isMobileDrawer={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          currentUser={currentUser}
          onMobileMenuOpen={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
