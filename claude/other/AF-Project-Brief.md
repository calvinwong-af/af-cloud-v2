# AcceleFreight (AF) — Platform Development Project Brief
**Last Updated:** 24 February 2026 (rev. 3 — Route Node logo finalised; prototype v5)  
**Status:** Public Website — Prototype Complete. Next: Next.js Production Build + AF Platform (TMS)

---

## 1. Company Overview

| Field | Detail |
|---|---|
| **Legal Name** | Accele Freight Sdn Bhd |
| **Registration No.** | 1292343-T |
| **Type** | Malaysian Incorporated Freight Forwarder & Multimodal Transport Operator (MTO) |
| **Founded** | Late 2018 |
| **Operations** | Malaysia (imports & exports via global partners) |
| **Clients** | Legally registered corporate and business entities only (no personal shipments) |
| **Copyright** | © 2025 Accele Freight Sdn Bhd (1292343-T) |

**Contact Details:**
- **Address:** 3, Jalan PJU 1A/8, Taman Perindustrian Jaya, Ara Damansara, 47301 Petaling Jaya, Selangor, Malaysia
- **Phone:** +60 12 820 8565
- **Email:** info@accelefreight.com
- **Public Website:** www.accelefreight.com
- **Internal Platform:** alfred.accelefreight.com

---

## 2. Services (Current — 9 Service Lines)

Listed in display order:

1. **Sea Freight** — FCL & LCL, import & export
2. **Air Freight** — Time-critical, port-to-port, import & export
3. **Cross-Border Trucking** — Land freight across MY–SG, MY–TH and regional corridors; includes border clearance coordination
4. **Distribution Services** — Last-mile & regional distribution across Malaysia; truck-load (1/3/5/10 ton) and haulage
5. **Warehousing** — Conventional storage for general cargo; inventory management
6. **Cold Storage** — Temperature-controlled storage for pharma, perishables, and food products
7. **Customs Clearance** — Documentation, customs examination representation, duty assessment & payment; import & export
8. **EOR / IOR Services** — Exporter of Record & Importer of Record for businesses without a Malaysian legal entity
9. **Outsourced Logistics Management & Consultation** — Full supply chain management outsourcing + standalone consultation

**Key content rules:**
- Do NOT mention "licensed" anywhere — removed by client request
- Do NOT mention bonded warehousing — removed by client request
- Do NOT mention the digital platform on the public website — only a Dashboard login button linking to alfred.accelefreight.com

---

## 3. Existing Technology Stack (Backend — Do Not Change)

| Component | Detail |
|---|---|
| **Frontend (current)** | Vue.js SPA on Firebase Hosting — being replaced |
| **Backend** | Firebase Datastore (Datastore mode), region: asia-northeast1 (Tokyo) |
| **Auth** | Firebase Authentication |
| **Database** | 437,501 entities, 543MB, 60 Kinds (entity types) |
| **Backups** | Automated weekly exports to `cloud-accele-freight.apps` GCS bucket |
| **Internal Platform URL** | alfred.accelefreight.com |

> ⚠️ All existing data stays in Firebase Datastore untouched. The rebuild is frontend-only. The new Next.js app connects to the same 60 Kinds via Firebase SDK.

---

## 4. Key Database Kinds (60 Total)

**User & Auth:** UserAccount, AFUserAccount, CompanyUserAccount  
**Company:** Company, CompanyContactsInformation  
**Pricing:** PricingAir, PricingFCL, PricingLCL, PricingHaulage, PricingTransport, PricingLocalCharges, PricingCustomsCharges  
**Quotations:** Quotation, QuotationAir, QuotationFCL, QuotationLCL, QuotationFreight  
**Shipments:** ShipmentOrder, ShipmentOrderAir, ShipmentOrderFCL, ShipmentOrderLCL  
**References:** Port, City, Country, Carrier, Airlines, Vessel  
**Finance:** Invoice, MasterInvoice, XeroAccounts  
**Files:** Files, FileTags  

---

## 5. User Roles (Internal Platform)

| Role | Description |
|---|---|
| **AFC** | AcceleFreight Company — internal staff |
| **AFU** | AcceleFreight User — client-facing |
| **Admin** | Full system access |

---

## 6. Three Core Pillars (Non-Negotiable for All Code)

Every module built must include:

### 6.1 Process Logging
- Collection: `AFSystemLogs`
- Captures: timestamp, user ID, account type, action, entity affected, before/after state, success/failure status

### 6.2 Error Handling
- Try/catch blocks on all async operations
- User-facing error messages (no raw stack traces shown to users)
- Full stack trace logging to AFSystemLogs
- Graceful degradation — app should never hard-crash

### 6.3 Security
- Firebase Auth with server-side token verification on all protected routes
- Role-based access control: AFC / AFU / Admin
- Firestore security rules enforced at database level
- **Margin and cost data must never be sent to client-side** (critical for quotation module)
- Input validation and sanitisation on all forms
- Sensitive config in environment variables only
- Full audit trail via AFSystemLogs

---

## 7. Recommended Production Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router, SSR for SEO) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Database** | Existing Firebase Datastore (no migration) |
| **Auth** | Existing Firebase Authentication |
| **Vibe Coding Tools** | Cursor + v0.dev |
| **Deployment** | Firebase Hosting (existing) or Vercel |

---

## 8. Public Website — Design System

### 8.1 Theme
**Slate & Sky Blue — Analytical / SaaS-style**

| Token | Value | Usage |
|---|---|---|
| `--slate` | `#0f1c2e` | Nav, footer, hero background, CTA bands |
| `--slate-mid` | `#1a2f47` | Secondary dark surfaces |
| `--slate-light` | `#243b55` | Tertiary dark |
| `--sky` | `#3b9eff` | Primary accent, buttons, links, icons |
| `--sky-light` | `#6cb8ff` | Hover states, secondary accent |
| `--sky-pale` | `#e8f4ff` | Icon backgrounds, tag backgrounds |
| `--sky-mist` | `#f0f7ff` | Hover surfaces, section backgrounds |
| `--white` | `#ffffff` | Card backgrounds, body |
| `--surface` | `#f7f9fc` | Alternating section backgrounds |
| `--border` | `#dde5ef` | Card borders, dividers |
| `--border-light` | `#edf2f8` | Subtle section separators |
| `--text` | `#0f1c2e` | Primary body text |
| `--text-mid` | `#3d5473` | Secondary text |
| `--text-muted` | `#7a93b0` | Labels, captions, placeholders |

### 8.2 Typography
| Role | Font | Weights |
|---|---|---|
| **Display / Headings** | Syne | 600, 700, 800 |
| **Body / UI** | Outfit | 300, 400, 500, 600 |
| **Monospace (IDs, stats, data)** | JetBrains Mono | 400, 500 |

Google Fonts import:
```
https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap
```

### 8.3 Logo
- **Logo mark:** Sky blue rounded square (`border-radius: 8px`) containing a white forward-arrow/chevron SVG
- **Wordmark:** "Accele" in white Syne 700 + "Freight" in `--sky-light` Syne 700
- SVG path for arrow mark: `M3 10 L8 5 L8 8 L14 8 L14 5 L17 10 L14 15 L14 12 L8 12 L8 15 Z` (viewBox 0 0 20 20)

### 8.4 Component Patterns
- **Cards:** White background, `1px solid var(--border)`, `border-radius: 6px`, blue top-bar reveal on hover (`scaleX` animation)
- **Buttons — Primary:** Sky blue fill, white text, `box-shadow: 0 2px 8px rgba(59,158,255,0.3)`, lifts on hover
- **Buttons — Outline:** Transparent, `1.5px solid var(--border)`, turns sky on hover
- **Buttons — White:** White fill, slate text (used on dark backgrounds)
- **Section eyebrow:** Sky blue, uppercase, `letter-spacing: 0.12em`, with a 18px blue bar prefix
- **Page banners:** Slate background with radial sky-blue glow at right, page-tag pill in sky-blue border
- **Form inputs:** White bg, `1.5px solid var(--border)`, focus ring `0 0 0 3px rgba(59,158,255,0.12)`
- **Tags/badges:** `--sky-pale` background, sky border, uppercase, `border-radius: 100px`
- **Nav:** Fixed, 68px height, full-width slate background, Dashboard as sky-blue filled button

### 8.5 Motion & Animation
- Page load: `fadeUp` keyframes, staggered with `.fade-1` through `.fade-5` (delays 0.05s–0.45s)
- Service cards: `scaleX` top-bar reveal on hover
- Hero card: `floatCard` 5s ease-in-out infinite (subtle vertical bob)
- Status dots: `pulse` opacity animation
- Services ticker: `ticker` linear infinite (30s, seamless loop)
- Network diagram: SVG `animateMotion` dots along logistics route paths

---

## 9. Public Website — Page Structure

### 9.1 Home Page
- **Hero:** Dark slate, grid texture overlay, sky glow. Left: badge + H1 + description + CTAs + stats. Right: animated shipment tracker card (live shipment mock)
- **Services Ticker:** Sky blue band, scrolling list of all 8 service lines
- **About Snippet:** Two-column — text left, animated logistics network SVG right
- **Services Preview:** 4-column grid of 8 service tiles (white grid, hover to sky-mist)
- **CTA Band:** Slate background, grid texture, white button
- **Footer:** Slate, 3-column (brand + nav + contact)

### 9.2 About Us Page
- Banner (slate) + Company story text + Values stack (4 values: Transparency, Efficiency, Reliability, Accessibility) + CTA band + Footer

### 9.3 Services Page
- Banner + 8-card grid (auto-fill minmax 330px) + "Not sure?" prompt bar + Footer
- **Service order:** Sea Freight → Air Freight → Cross-Border Trucking → Distribution → Warehousing → Cold Storage → Customs Clearance → EOR/IOR → Outsourced Logistics

### 9.4 FAQ Page
- Banner + Two-tab accordion (Company / Services)
- **Company tab:** What type of company, where do you operate, how to get started
- **Services tab:** How to appoint AF, personal items policy, EOR/IOR explainer, outsourced logistics explainer

### 9.5 Contact Us Page
- Banner + Two-column layout (contact info left, form right) + Google Maps embed + Footer
- **Map embed:** Ara Damansara, 47301 Petaling Jaya (approximate coordinates: 3.1262°N, 101.5879°E)
- **Google Maps link:** `https://maps.google.com/?q=3+Jalan+PJU+1A/8+Taman+Perindustrian+Jaya+Ara+Damansara+47301+Petaling+Jaya+Selangor`
- **Form fields:** Full Name, Company Name, Email, Phone, Service Enquiry (dropdown), Message

---

## 10. Logistics Network SVG (Home Page — About Section)

The SVG shows the full AF logistics flow:
- **Left nodes:** Air Origin + Sea Origin (animated dots travelling to hub)
- **Centre:** AF Hub hexagon (sky blue, with white arrow mark)
- **Right nodes:** Distribution, Warehousing, Clearance
- **Far right:** End-point delivery circles
- **Animation:** SVG `animateMotion` dots travel along dashed route paths continuously
- **Legend bar** at bottom: active routes, connection lines, hub marker, service node

---

## 11. Planned Build Order (Production)

1. **Dev environment setup** — Next.js 14, Tailwind, Firebase SDK, env vars
2. **Auth flow** — Login page, role detection (AFC/AFU/Admin), protected routes
3. **Quotation module** — Highest priority; 5-step wizard (mode → add-ons → pricing → files → review)
4. **Shipment tracking** — Status updates, document management
5. **Pricing tables** — Air/FCL/LCL/Haulage/Local charges management
6. **Invoicing + Xero integration** — Invoice generation, sync to Xero

---

## 12. Quotation Module — Known Context

**5-step wizard flow:**
1. Shipment mode, cargo details, origin/destination
2. Add-ons: customs, trucking, insurance
3. Price breakdown with margins (margin data server-side only, never exposed to client)
4. Required files upload (conditional based on shipment type)
5. Review & generate quotation document

**Stats:** 2,000+ quotations already processed in the existing system.

**Key business logic:**
- Incoterm-aware pricing
- Multi-currency support
- Conditional fields based on mode (Air/FCL/LCL)
- Document generation on completion

---

## 13. Current Deliverable — Prototype File

**File:** `AF-Website-Prototype-v5.html`  
A single-file HTML prototype with all 5 pages (Home, About, Services, FAQ, Contact) using JavaScript page switching. This is for review and design validation only — not production-ready.

**To convert to production:** Each `<section id="...">` becomes its own Next.js page route. The JS `showPage()` function is replaced by Next.js `<Link>` navigation.

---

## 14. Decisions Made — Do Not Revisit

| Decision | Choice |
|---|---|
| Production framework | Next.js 14 |
| Design theme | Slate & Sky Blue (analytical/SaaS) |
| Platform mention on public site | None — Dashboard login button only |
| "Licensed" keyword | Removed throughout |
| Bonded warehousing | Removed from all services |
| Ground Transportation | Renamed to Distribution Services |
| Warehousing + Cold Storage | Separated into two distinct service cards (Warehousing / Cold Storage) |
| Cross-Border Trucking | Added as standalone service after Air Freight |
| Outsourced Logistics Management & Consultation | Added as new service |
| Home services grid | 3-column × 3 rows (9 tiles) — updated from 4-column when Cold Storage was split out |
| Hero title | "Your complete logistics solution." |
| Map on contact page | Google Maps iframe embed (dark-mode filter applied) |
| Logo mark | Route Node — pointy-top hexagon, hub ring, 3 routes (1 top / 2 bottom). Applied to nav + all 5 footers in v5 |
| Logo mark size integrity | 5-tier system: 64px full detail → 16px hard minimum; stroke weights increase per tier |

---

## 15. Outstanding / Next Steps

- [ ] Owner review and sign-off on prototype design
- [x] Obtain exact Google Maps embed URL for Ara Damansara office and update prototype
- [x] Owner decision on logo concept — Route Node selected and applied (v5)
- [ ] Next.js 14 project setup and dev environment
- [ ] Firebase SDK integration (read existing Datastore)
- [ ] Implement Three Core Pillars across all modules
- [ ] Auth flow and role-based routing
- [ ] Quotation module rebuild (highest priority)
- [ ] Shipment tracking module
- [ ] Pricing table management
- [ ] Invoicing + Xero integration
