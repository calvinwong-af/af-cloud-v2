// AF Route Node logo mark — pointy-top hexagon with hub ring and 3 routes
// Ported from af-web, adapted for platform use

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 36, className = "" }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <polygon points="32,6 52.8,18 52.8,42 32,54 11.2,42 11.2,18" fill="#3b9eff"/>
      <line x1="32" y1="30" x2="32" y2="6" stroke="rgba(255,255,255,0.45)" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="32" y1="30" x2="52.8" y2="42" stroke="rgba(255,255,255,0.45)" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="32" y1="30" x2="11.2" y2="42" stroke="rgba(255,255,255,0.45)" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="32" cy="6" r="4.5" fill="rgba(255,255,255,0.8)"/>
      <circle cx="52.8" cy="42" r="4.5" fill="rgba(255,255,255,0.8)"/>
      <circle cx="11.2" cy="42" r="4.5" fill="rgba(255,255,255,0.8)"/>
      <circle cx="32" cy="30" r="7.5" fill="white"/>
      <circle cx="32" cy="30" r="4" fill="#3b9eff"/>
    </svg>
  );
}

interface LogoLockupProps {
  variant?: "dark" | "light";
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
  const accelColor = variant === "dark" ? "white" : "var(--slate)";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={mark} />
      <span
        className="font-display"
        style={{
          fontWeight: 700,
          fontSize,
          color: accelColor,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        Accele
        <span style={{ color: "var(--sky-light)" }}>Freight</span>
      </span>
    </div>
  );
}
