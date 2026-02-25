// AF Route Node logo mark — pointy-top hexagon with hub ring and 3 routes
// Size tiers: 64px (full detail) → 36px (nav) → 20px (favicon minimum)
// Source: AF-Logo-RouteNode-v2.html + AF-Project-Brief.md § 8.3

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 36, className = "" }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Hexagon body */}
      <polygon
        points="32,6 52.8,18 52.8,42 32,54 11.2,42 11.2,18"
        fill="#3b9eff"
      />
      {/* Route lines from hub */}
      <line x1="32" y1="30" x2="32"   y2="6"    stroke="rgba(255,255,255,0.45)" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="32" y1="30" x2="52.8" y2="42"   stroke="rgba(255,255,255,0.45)" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="32" y1="30" x2="11.2" y2="42"   stroke="rgba(255,255,255,0.45)" strokeWidth="2.8" strokeLinecap="round" />
      {/* Endpoint nodes */}
      <circle cx="32"   cy="6"  r="4" fill="rgba(255,255,255,0.8)" />
      <circle cx="52.8" cy="42" r="4" fill="rgba(255,255,255,0.8)" />
      <circle cx="11.2" cy="42" r="4" fill="rgba(255,255,255,0.8)" />
      {/* Hub — outer ring */}
      <circle cx="32" cy="30" r="7" fill="white" />
      {/* Hub — inner dot */}
      <circle cx="32" cy="30" r="3.8" fill="#3b9eff" />
    </svg>
  );
}

interface LogoLockupProps {
  variant?: "dark" | "light"; // dark = white wordmark, light = slate wordmark
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { mark: 28, fontSize: "1rem" },
  md: { mark: 36, fontSize: "1.2rem" },
  lg: { mark: 44, fontSize: "1.5rem" },
};

export function LogoLockup({
  variant = "dark",
  size = "md",
  className = "",
}: LogoLockupProps) {
  const { mark, fontSize } = sizeMap[size];
  const accelColor = variant === "dark" ? "white" : "#0f1c2e";

  return (
    <div
      className={`flex items-center gap-2.5 ${className}`}
      style={{ textDecoration: "none" }}
    >
      <LogoMark size={mark} />
      <span
        style={{
          fontFamily: "var(--font-syne), sans-serif",
          fontWeight: 700,
          fontSize,
          color: accelColor,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        Accele
        <span style={{ color: "#6cb8ff" }}>Freight</span>
      </span>
    </div>
  );
}
