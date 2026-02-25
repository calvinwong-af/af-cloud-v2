"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { onAuthChange, startTokenRefresh } from "@/lib/auth";
import { LogoMark } from "@/components/shared/Logo";
import { PlatformShell } from "@/components/shell/PlatformShell";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        router.push("/login");
      }
    });
    const unsubToken = startTokenRefresh();
    return () => {
      unsubAuth();
      unsubToken();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--surface)" }}>
        <LogoMark size={48} className="animate-pulse" />
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
          Loading platform…
        </p>
      </div>
    );
  }

  return (
    <PlatformShell currentUser={user!}>
      {children}
    </PlatformShell>
  );
}
