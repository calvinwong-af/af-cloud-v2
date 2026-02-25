"use client";

import type { User } from "firebase/auth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface PlatformShellProps {
  currentUser: User;
  children: React.ReactNode;
}

export function PlatformShell({ currentUser, children }: PlatformShellProps) {
  return (
    <div className="h-screen flex flex-row overflow-hidden">
      <Sidebar currentUser={currentUser} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar currentUser={currentUser} />
        <main className="flex-1 overflow-y-auto" style={{ padding: "1.75rem" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
