"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { signIn } from "@/lib/auth";
import { LogoMark } from "@/components/shared/Logo";
import { RouteMapSVG } from "@/components/login/RouteMapSVG";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Invalid email or password. Please try again.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen h-screen flex flex-row overflow-hidden">
      {/* ── LEFT PANEL ── */}
      <div
        className="h-screen flex flex-col relative overflow-hidden shrink-0"
        style={{ background: "var(--slate-mid)", width: "52%" }}
      >
        {/* Grid texture overlay */}
        <div className="grid-texture pointer-events-none absolute inset-0" />

        {/* Radial glow accents */}
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, var(--sky) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, var(--sky-light) 0%, transparent 70%)" }}
        />

        {/* Top: Logo block — in normal flow at top */}
        <div className="relative z-10 px-8 pt-8 lg:px-12 lg:pt-10">
          <div className="flex items-center gap-3">
            <LogoMark size={40} />
            <span
              className="font-display text-[1.4rem] font-bold leading-none tracking-tight text-white"
            >
              Accele<span style={{ color: "var(--sky-light)" }}>Freight</span>
            </span>
          </div>
          <p
            className="font-mono mt-2 ml-[52px] text-[0.65rem] uppercase tracking-[0.2em]"
            style={{ color: "var(--text-muted)" }}
          >
            Operations Platform
          </p>
        </div>

        {/* Centre: Animated route map — absolutely centred */}
        <RouteMapSVG />

        {/* Bottom: Caption — pinned bottom-left */}
        <div className="absolute bottom-8 left-8 z-10 lg:bottom-10 lg:left-12">
          <p
            className="font-mono text-[0.65rem] uppercase tracking-[0.15em]"
            style={{ color: "var(--text-muted)" }}
          >
            Freight Forwarding &middot; Logistics &middot; Supply Chain
          </p>
          <p
            className="mt-1.5 text-sm"
            style={{ color: "var(--sky-light)" }}
          >
            Your cargo, every leg of the way — tracked.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        className="flex-1 h-screen flex flex-col items-center justify-center overflow-hidden px-8 py-12 lg:px-16 xl:px-24"
        style={{ background: "var(--slate)" }}
      >
        <div className="w-full max-w-[400px]">
          {/* Heading */}
          <h1 className="font-display text-3xl font-bold text-white">
            Sign in
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Access is restricted to authorised AcceleFreight personnel and registered clients.
          </p>

          {/* Divider with label */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: "var(--slate-light)" }} />
            <span
              className="font-mono text-[0.6rem] uppercase tracking-[0.2em]"
              style={{ color: "var(--text-muted)" }}
            >
              credentials
            </span>
            <div className="h-px flex-1" style={{ background: "var(--slate-light)" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Email field */}
            <div>
              <div
                className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors focus-within:border-[var(--sky)]"
                style={{ background: "var(--slate-mid)", borderColor: "var(--slate-light)" }}
              >
                <Mail size={16} style={{ color: "var(--text-muted)" }} className="shrink-0" />
                <input
                  type="email"
                  placeholder="Email address"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder:text-[var(--text-muted)] outline-none autofill:bg-[#1a2f47] autofill:text-white autofill:shadow-[inset_0_0_0px_1000px_#1a2f47]"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <div
                className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors focus-within:border-[var(--sky)]"
                style={{ background: "var(--slate-mid)", borderColor: "var(--slate-light)" }}
              >
                <Lock size={16} style={{ color: "var(--text-muted)" }} className="shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder:text-[var(--text-muted)] outline-none autofill:bg-[#1a2f47] autofill:text-white autofill:shadow-[inset_0_0_0px_1000px_#1a2f47]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="shrink-0 outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={16} style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <Eye size={16} style={{ color: "var(--text-muted)" }} />
                  )}
                </button>
              </div>
            </div>

            {/* Keep signed in + Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[var(--slate-light)] accent-[var(--sky)]"
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Keep me signed in
                </span>
              </label>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setResetEmail(email); setForgotMode(true); setResetError(""); setResetSent(false); }}
                className="text-xs transition-colors hover:text-white"
                style={{ color: "var(--sky-light)" }}
              >
                Forgot password?
              </a>
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* Forgot password inline panel */}
            {forgotMode && (
              <div className="rounded-lg border px-4 py-4 space-y-3" style={{ background: "var(--slate-mid)", borderColor: "var(--slate-light)" }}>
                {resetSent ? (
                  <div className="space-y-2">
                    <p className="text-sm text-emerald-400">Password reset email sent. Check your inbox.</p>
                    <button
                      type="button"
                      onClick={() => setForgotMode(false)}
                      className="text-xs transition-colors hover:text-white"
                      style={{ color: "var(--sky-light)" }}
                    >
                      &larr; Back to sign in
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Enter your email to receive a reset link.</p>
                    <div className="flex items-center gap-3 rounded-lg border px-4 py-3 focus-within:border-[var(--sky)]" style={{ borderColor: "var(--slate-light)" }}>
                      <Mail size={16} style={{ color: "var(--text-muted)" }} className="shrink-0" />
                      <input
                        type="email"
                        placeholder="Email address"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full bg-transparent text-sm text-white placeholder:text-[var(--text-muted)] outline-none"
                      />
                    </div>
                    {resetError && <p className="text-xs text-red-400">{resetError}</p>}
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setForgotMode(false)}
                        className="text-xs transition-colors hover:text-white"
                        style={{ color: "var(--text-muted)" }}
                      >
                        &larr; Back
                      </button>
                      <button
                        type="button"
                        disabled={resetSending}
                        onClick={async () => {
                          if (!resetEmail.trim()) { setResetError("Enter your email address"); return; }
                          setResetSending(true);
                          setResetError("");
                          try {
                            const { getFirebaseAuth } = await import("@/lib/firebase");
                            await sendPasswordResetEmail(getFirebaseAuth(), resetEmail.trim());
                            setResetSent(true);
                          } catch (err: unknown) {
                            const code = (err as { code?: string })?.code ?? "";
                            if (code === "auth/user-not-found" || code === "auth/invalid-email") {
                              setResetError("No account found with this email.");
                            } else {
                              setResetError("Failed to send reset email. Please try again.");
                            }
                          } finally {
                            setResetSending(false);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:brightness-110 disabled:opacity-60 transition-all"
                        style={{ background: "var(--sky)" }}
                      >
                        {resetSending && <Loader2 size={14} className="animate-spin" />}
                        Send Reset Email
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Submit button */}
            {!forgotMode && (
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
                style={{ background: "var(--sky)" }}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Sign in to Platform
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </form>

          {/* Footer note */}
          <div className="mt-10 space-y-1">
            <p className="text-[0.65rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Unauthorised access is prohibited. All activity is monitored and logged.
              By signing in, you agree to AcceleFreight&apos;s terms of use and privacy policy.
            </p>
            <p
              className="font-mono text-[0.6rem]"
              style={{ color: "var(--slate-light)" }}
            >
              AcceleFreight (Pty) Ltd &middot; Reg. 2023/001234/07
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
