// Animated route map SVG for login page left panel
// Nodes: Air Origin, Sea Origin → AF Hub (hexagon, pulsing) → Distribution, Warehousing, Clearance → Last-mile endpoints
// Animated travel dots via SVG animateMotion, sky-blue palette on dark

export function RouteMapSVG() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 p-12">
    <svg
      viewBox="0 0 520 340"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ maxWidth: "560px", maxHeight: "75vh" }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Glow filter for nodes */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Stronger glow for hub */}
        <filter id="hubGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Travel dot */}
        <circle id="dot" r="3" fill="var(--sky-light)" opacity="0.9" />
      </defs>

      {/* ── Paths (drawn first, behind nodes) ── */}

      {/* Air Origin → Hub */}
      <path id="pathAirHub" d="M 110 90 C 170 90, 210 150, 260 170" stroke="var(--sky)" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
      {/* Sea Origin → Hub */}
      <path id="pathSeaHub" d="M 110 250 C 170 250, 210 200, 260 170" stroke="var(--sky)" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />

      {/* Hub → Distribution */}
      <path id="pathHubDist" d="M 290 170 C 330 140, 350 100, 390 80" stroke="var(--sky)" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
      {/* Hub → Warehousing */}
      <path id="pathHubWare" d="M 290 170 C 330 170, 350 170, 390 170" stroke="var(--sky)" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
      {/* Hub → Clearance */}
      <path id="pathHubClear" d="M 290 170 C 330 200, 350 240, 390 260" stroke="var(--sky)" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />

      {/* Distribution → Last-mile A */}
      <path id="pathDistLMA" d="M 410 80 C 430 60, 440 45, 470 35" stroke="var(--sky)" strokeWidth="1" strokeOpacity="0.2" fill="none" />
      {/* Distribution → Last-mile B */}
      <path id="pathDistLMB" d="M 410 80 C 430 90, 445 100, 470 105" stroke="var(--sky)" strokeWidth="1" strokeOpacity="0.2" fill="none" />
      {/* Warehousing → Last-mile C */}
      <path id="pathWareLMC" d="M 410 170 C 435 165, 450 160, 470 170" stroke="var(--sky)" strokeWidth="1" strokeOpacity="0.2" fill="none" />
      {/* Clearance → Last-mile D */}
      <path id="pathClearLMD" d="M 410 260 C 435 270, 450 280, 470 290" stroke="var(--sky)" strokeWidth="1" strokeOpacity="0.2" fill="none" />

      {/* ── Animated travel dots ── */}

      {/* Air → Hub */}
      <use href="#dot">
        <animateMotion dur="3s" repeatCount="indefinite">
          <mpath href="#pathAirHub" />
        </animateMotion>
      </use>

      {/* Sea → Hub */}
      <use href="#dot">
        <animateMotion dur="3.5s" repeatCount="indefinite" begin="0.5s">
          <mpath href="#pathSeaHub" />
        </animateMotion>
      </use>

      {/* Hub → Distribution */}
      <use href="#dot">
        <animateMotion dur="2.5s" repeatCount="indefinite" begin="1s">
          <mpath href="#pathHubDist" />
        </animateMotion>
      </use>

      {/* Hub → Warehousing */}
      <use href="#dot">
        <animateMotion dur="2.8s" repeatCount="indefinite" begin="0.3s">
          <mpath href="#pathHubWare" />
        </animateMotion>
      </use>

      {/* Hub → Clearance */}
      <use href="#dot">
        <animateMotion dur="3.2s" repeatCount="indefinite" begin="0.8s">
          <mpath href="#pathHubClear" />
        </animateMotion>
      </use>

      {/* Distribution → Last-mile A */}
      <use href="#dot">
        <animateMotion dur="2s" repeatCount="indefinite" begin="1.5s">
          <mpath href="#pathDistLMA" />
        </animateMotion>
      </use>

      {/* Warehousing → Last-mile C */}
      <use href="#dot">
        <animateMotion dur="2.2s" repeatCount="indefinite" begin="0.7s">
          <mpath href="#pathWareLMC" />
        </animateMotion>
      </use>

      {/* ── Origin Nodes (left side) ── */}

      {/* Air Origin */}
      <g filter="url(#glow)">
        <circle cx="110" cy="90" r="18" fill="var(--slate-light)" stroke="var(--sky)" strokeWidth="1.5" strokeOpacity="0.5" />
        {/* Plane icon */}
        <text x="110" y="94" textAnchor="middle" fontSize="14" fill="var(--sky-light)">✈</text>
      </g>
      <text x="110" y="122" textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">AIR ORIGIN</text>

      {/* Sea Origin */}
      <g filter="url(#glow)">
        <circle cx="110" cy="250" r="18" fill="var(--slate-light)" stroke="var(--sky)" strokeWidth="1.5" strokeOpacity="0.5" />
        {/* Ship icon */}
        <text x="110" y="254" textAnchor="middle" fontSize="14" fill="var(--sky-light)">⚓</text>
      </g>
      <text x="110" y="282" textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">SEA ORIGIN</text>

      {/* ── AF Hub (centre hexagon with pulse) ── */}
      <g filter="url(#hubGlow)">
        {/* Pulse ring */}
        <circle cx="275" cy="170" r="30" fill="none" stroke="var(--sky)" strokeWidth="1" opacity="0.3">
          <animate attributeName="r" values="30;42;30" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" repeatCount="indefinite" />
        </circle>
        {/* Hexagon body */}
        <polygon
          points="275,140 300,155 300,185 275,200 250,185 250,155"
          fill="var(--slate-light)"
          stroke="var(--sky)"
          strokeWidth="2"
        />
        {/* Inner hex accent */}
        <polygon
          points="275,150 290,158 290,182 275,190 260,182 260,158"
          fill="none"
          stroke="var(--sky-light)"
          strokeWidth="0.8"
          strokeOpacity="0.4"
        />
        {/* Hub label */}
        <text x="275" y="167" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--sky-light)" fontFamily="var(--font-mono)">AF</text>
        <text x="275" y="178" textAnchor="middle" fontSize="7" fill="var(--sky-light)" fontFamily="var(--font-mono)" opacity="0.7">HUB</text>
      </g>

      {/* ── Mid-tier Nodes (right side) ── */}

      {/* Distribution */}
      <g filter="url(#glow)">
        <rect x="375" y="65" width="36" height="30" rx="6" fill="var(--slate-light)" stroke="var(--sky)" strokeWidth="1" strokeOpacity="0.4" />
        <text x="393" y="84" textAnchor="middle" fontSize="10" fill="var(--sky-light)">📦</text>
      </g>
      <text x="393" y="108" textAnchor="middle" fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-mono)">DISTRIBUTION</text>

      {/* Warehousing */}
      <g filter="url(#glow)">
        <rect x="375" y="155" width="36" height="30" rx="6" fill="var(--slate-light)" stroke="var(--sky)" strokeWidth="1" strokeOpacity="0.4" />
        <text x="393" y="174" textAnchor="middle" fontSize="10" fill="var(--sky-light)">🏭</text>
      </g>
      <text x="393" y="198" textAnchor="middle" fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-mono)">WAREHOUSING</text>

      {/* Clearance */}
      <g filter="url(#glow)">
        <rect x="375" y="245" width="36" height="30" rx="6" fill="var(--slate-light)" stroke="var(--sky)" strokeWidth="1" strokeOpacity="0.4" />
        <text x="393" y="264" textAnchor="middle" fontSize="10" fill="var(--sky-light)">📋</text>
      </g>
      <text x="393" y="288" textAnchor="middle" fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-mono)">CLEARANCE</text>

      {/* ── Last-mile endpoints ── */}

      <circle cx="470" cy="35" r="6" fill="var(--slate-light)" stroke="var(--sky)" strokeWidth="1" strokeOpacity="0.3" />
      <circle cx="470" cy="105" r="6" fill="var(--slate-light)" stroke="var(--sky)" strokeWidth="1" strokeOpacity="0.3" />
      <circle cx="470" cy="170" r="6" fill="var(--slate-light)" stroke="var(--sky)" strokeWidth="1" strokeOpacity="0.3" />
      <circle cx="470" cy="290" r="6" fill="var(--slate-light)" stroke="var(--sky)" strokeWidth="1" strokeOpacity="0.3" />

      <text x="488" y="38" fontSize="7" fill="var(--text-muted)" fontFamily="var(--font-mono)" opacity="0.6">ENDPOINT</text>
      <text x="488" y="108" fontSize="7" fill="var(--text-muted)" fontFamily="var(--font-mono)" opacity="0.6">ENDPOINT</text>
      <text x="488" y="173" fontSize="7" fill="var(--text-muted)" fontFamily="var(--font-mono)" opacity="0.6">ENDPOINT</text>
      <text x="488" y="293" fontSize="7" fill="var(--text-muted)" fontFamily="var(--font-mono)" opacity="0.6">ENDPOINT</text>
    </svg>
    </div>
  );
}
