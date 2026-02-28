# PROMPT — Mobile Responsiveness: af-web + af-platform
**Date:** 28 February 2026
**Scope:** Full mobile responsiveness pass across both frontends
**Priority:** High — foundational, must be done before further feature builds

---

## Context

This is a progressive replacement of `alfred.accelefreight.com` (old Vue TMS). The new system consists of:
- `af-web/` — public website (`www.accelefreight.com`) — Next.js 14, static, 5 pages
- `af-platform/` — internal TMS (`appv2.accelefreight.com`) — Next.js 14 App Router, authenticated

Both are currently desktop-only. This prompt covers a full mobile responsiveness pass on both.

Read `AF-Coding-Standards.md` before starting. Run `npm run lint` in `af-platform/` before finishing.

---

## Design System Reference

**Breakpoints to use consistently across both projects:**
- Mobile: `< 640px`
- Tablet: `640px – 1024px`
- Desktop: `> 1024px`

**Design tokens (defined in `af-web/src/styles/globals.css` — shared visual language):**
```
--slate: #0f1c2e  --sky: #3b9eff  --sky-light: #6cb8ff
--sky-pale: #e8f4ff  --surface: #f7f9fc  --border: #dde5ef
--text: #0f1c2e  --text-mid: #3d5473  --text-muted: #7a93b0
```

**Fonts:** Syne (headings), Outfit (body), JetBrains Mono (IDs/data)

---

## PART 1 — af-web (Public Website)

### Files to modify:
- `af-web/src/components/layout/Navbar.tsx`
- `af-web/src/components/layout/Footer.tsx`
- `af-web/src/app/page.tsx` (Home)
- `af-web/src/app/about/page.tsx`
- `af-web/src/app/services/page.tsx`
- `af-web/src/app/faq/page.tsx`
- `af-web/src/app/contact/page.tsx`
- `af-web/src/components/home/ServicesGrid.tsx`
- `af-web/src/styles/globals.css` (add mobile utility classes / media queries as needed)

### 1.1 — Navbar (`Navbar.tsx`)

The Navbar already has a hamburger menu with `isMobile` state driven by `window.innerWidth < 768`. This pattern works but has issues:

**Problems to fix:**
- `isMobile` is set with a JS `useEffect` — on first render it defaults to `false`, causing a flash of the desktop nav on mobile before hydration. Replace the `isMobile` state pattern with CSS-only show/hide using Tailwind responsive classes (`hidden md:flex`, `flex md:hidden`) so it is correct on first paint with no JS flash.
- The mobile menu dropdown has no close-on-outside-click behaviour. Add a `useEffect` that listens for clicks outside the menu div and closes it.
- The mobile menu has no animation — it appears/disappears abruptly. Add a smooth slide-down transition (CSS `max-height` transition from 0 to auto equivalent, or a `transform: translateY` approach).

**Keep intact:**
- All existing links, Dashboard button, legacy button
- LogoLockup component usage
- Active state detection via `usePathname`

### 1.2 — Home Page (`app/page.tsx`)

**Hero section:**
- The hero layout is a single column centred block — this is fine on mobile, but the shipment tracker card at the bottom of the hero breaks at narrow widths because it uses `display: flex` with multiple fixed-width children and pipe dividers.
- On mobile (`< 640px`): hide the pipe dividers, stack the tracker items vertically (Live Tracking ID, Route, Mode as a 2-column grid, timeline strip below, status badge below that). The tracker card should remain visible on mobile — it's part of the brand story.
- The hero stats row (`2018 / 9+ / 2,000+`) should remain in a horizontal row on mobile since the values are short — just reduce the gap.
- `clamp()` font sizes are already in use — no changes needed there.

**About / Network SVG section:**
- The `repeat(auto-fit, minmax(300px, 1fr))` grid will naturally stack on mobile — this is correct behaviour.
- The network SVG: on mobile, constrain its `max-width` to `100%` and ensure the SVG `viewBox` scales correctly. The SVG is already responsive via `width: 100%` — verify this is correct and that the legend text at the bottom is legible on small screens (it uses `fontSize: 8` which may be too small; consider hiding the legend on mobile only).

**Services Grid section:**
- The `ServicesGrid` uses `repeat(auto-fill, minmax(200px, 1fr))` — this works down to ~400px wide. On very narrow screens (< 400px) it may create a single column that is too narrow. Ensure a minimum of 1 column and tile content doesn't overflow.

**CTA Band:**
- Already centred — no changes needed beyond verifying padding scales correctly on narrow screens.

### 1.3 — About Page (`app/about/page.tsx`)

**Story + Values grid:**
- Uses `repeat(auto-fit, minmax(300px, 1fr))` — will stack naturally. Reduce the `gap` from `64px` to `40px` on mobile to avoid excessive whitespace.

**Stats band:**
- Uses `repeat(auto-fit, minmax(160px, 1fr))` — will stack or flow into 2 columns on mobile. This is acceptable. Reduce font sizes slightly if needed.

**Page banner:**
- `clamp()` already handles heading size. No changes needed.

### 1.4 — Services Page (`app/services/page.tsx`)

**Services grid:**
- Uses `repeat(auto-fill, minmax(330px, 1fr))` — on mobile this forces cards to be at minimum 330px wide, which overflows on a 375px iPhone screen. Change to `repeat(auto-fill, minmax(min(330px, 100%), 1fr))` so cards go full-width on narrow screens.

**"Not sure?" prompt bar:**
- Uses `gridTemplateColumns: "1fr 1.6fr"` — will break on mobile. Change the Contact grid to a CSS-only approach: stack vertically on mobile (contact info full width, then form full width), side-by-side on desktop.

### 1.5 — FAQ Page (`app/faq/page.tsx`)

- Max-width 800px centred — works fine on mobile with `5%` padding.
- FAQ accordion items — no changes needed, they are already full-width.
- "Still have questions?" bar uses `flexWrap: wrap` — acceptable, button will wrap below text on mobile.
- Tab buttons — ensure tap targets are at least 44px tall (add `minHeight: 44px` to tab buttons).

### 1.6 — Contact Page (`app/contact/page.tsx`)

**Contact info + form grid:**
- Uses `gridTemplateColumns: "1fr 1.6fr"` — fixed two columns, will break at narrow widths.
- On mobile: stack vertically (contact info above, form below). Use a CSS media query or Tailwind responsive grid.

**Form inputs:**
- The name/company and email/phone rows use `gridTemplateColumns: "1fr 1fr"` — on mobile these should stack to single column. Use `repeat(auto-fit, minmax(240px, 1fr))` or a Tailwind `grid-cols-1 sm:grid-cols-2` pattern.

**Map:**
- The iframe map is `height: 360px` and `width: 100%` — this is fine on mobile, but reduce height to `220px` on mobile to avoid it dominating the screen.

### 1.7 — globals.css additions

Add responsive utility classes that are reused across pages:
```css
/* Reduce section vertical padding on mobile */
@media (max-width: 640px) {
  .section-pad { padding-top: 60px; padding-bottom: 60px; }
  .page-banner { padding: 56px 5% 44px; }
}
```

---

## PART 2 — af-platform (Internal TMS)

### Files to modify:
- `af-platform/src/components/shell/PlatformShell.tsx`
- `af-platform/src/components/shell/Sidebar.tsx`
- `af-platform/src/components/shell/Topbar.tsx`
- `af-platform/src/components/shipments/ShipmentOrderTable.tsx`
- `af-platform/src/app/(platform)/shipments/page.tsx` (if it exists — check)
- `af-platform/src/app/globals.css` (or equivalent — add mobile utility styles)

Do NOT modify shipment detail page, task components, or modals in this pass. Focus is on shell + list views only.

### 2.1 — Shell Architecture (`PlatformShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`)

**Current state:** `PlatformShell` is a fixed `flex-row` layout — sidebar on the left, content area on the right. On mobile the sidebar takes 64px (collapsed) which is still present and reduces the content area on an already narrow screen.

**Target behaviour:**
- **Desktop (>= 1024px):** Current behaviour unchanged — sidebar always visible, collapsible to 64px icon strip.
- **Tablet (640px – 1024px):** Sidebar collapsed to 64px icon strip by default. Content area fills remaining space.
- **Mobile (< 640px):** Sidebar is **hidden entirely** from the layout flow. A hamburger icon in the Topbar triggers a **drawer** that slides in from the left as an overlay (not pushing content). The drawer contains the full expanded sidebar (240px). Clicking outside the drawer or a nav link closes it.

**Implementation notes for `PlatformShell.tsx`:**
- Add `isMobileOpen` state (boolean, default false) passed down to Sidebar and Topbar.
- On mobile, wrap the Sidebar in a conditional overlay: a full-screen semi-transparent backdrop (`position: fixed, inset: 0, bg: rgba(0,0,0,0.5), z-index: 200`) that closes on click, plus the sidebar itself positioned `fixed, left: 0, top: 0, bottom: 0, z-index: 201, width: 240px, transform: translateX(isMobileOpen ? 0 : -100%), transition: transform 0.25s`.
- On desktop/tablet, current sidebar behaviour is preserved.
- Use a Tailwind breakpoint (`lg:`) to switch between modes cleanly. Do not use JS window resize detection — use CSS media queries / Tailwind classes for layout switching.

**Implementation notes for `Topbar.tsx`:**
- On mobile (below `lg:`), show a hamburger button (Menu icon from lucide-react) on the LEFT side of the topbar, before the breadcrumb.
- The hamburger calls `onMobileMenuOpen()` prop from PlatformShell.
- Keep all existing topbar content (breadcrumb, search, bells, avatar).
- On mobile, hide the QuickSearch bar by default (it takes too much space). Show a search icon button instead that expands the search inline, or simply hide it — simplest acceptable option is to hide it on mobile for now.

**Implementation notes for `Sidebar.tsx`:**
- The sidebar's existing collapse/expand behaviour (chevron button, localStorage state) remains for desktop.
- On mobile, the sidebar always renders expanded (240px) when the drawer is open — the collapse button is hidden on mobile.
- Add a close button (X icon) at the top right of the sidebar when rendered as a mobile drawer.
- Clicking any nav link on mobile closes the drawer (call `onClose()` prop).

### 2.2 — Shipment List Table (`ShipmentOrderTable.tsx`)

The shipment table is a dense data table with many columns. On mobile it needs a different presentation.

**Target behaviour:**
- **Desktop/Tablet (>= 768px):** Current table layout unchanged.
- **Mobile (< 768px):** Hide the full table. Render each shipment as a **card** instead.

**Card layout for mobile (per shipment row):**
```
┌─────────────────────────────────────┐
│ [Status badge]           [Exception?]│
│ AFCQ-003867                          │
│ Port Klang → Shanghai                │
│ Sea · FCL  ·  28 Feb 2026            │
│ Company Name                         │
└─────────────────────────────────────┘
```

Specifically:
- Status badge (coloured pill, same as desktop) top-left
- Exception flag icon (AlertTriangle) top-right if applicable
- Shipment ID in JetBrains Mono font, prominent
- Origin → Destination route
- Mode · submode · date in muted small text
- Company name below
- Full card is tappable (same `href` as the desktop row)
- Cards have 1px border, `border-radius: 8px`, white background, `box-shadow: 0 1px 4px rgba(0,0,0,0.06)`
- Active tap state: `background: var(--sky-mist)`

**Implementation:** Use the `ShipmentOrder` type already defined in `lib/types.ts`. The card renders the same data already available in the table row. Add `md:hidden` to the card list wrapper and `hidden md:block` to the table wrapper to switch between them.

**Status colour mapping** — use the same `STATUS_MAP` already defined or referenced in the table component. Do not create a new mapping.

### 2.3 — List Page Layout

Check `af-platform/src/app/(platform)/shipments/page.tsx`. If the list page has filters, tab selectors, or search inputs at the top:
- Ensure tab row scrolls horizontally on mobile (`overflow-x: auto`, no wrapping) rather than wrapping onto multiple lines.
- Any `flex` row of filter chips should use `flex-wrap: nowrap` + `overflow-x: auto` on mobile.
- The "New Shipment" button should remain visible on mobile.

---

## Acceptance Criteria

### af-web
- [ ] Navbar: no flash on mobile, smooth dropdown animation, outside-click closes menu
- [ ] Home hero tracker card: readable and usable on 375px iPhone width
- [ ] Services page cards: no horizontal overflow on mobile
- [ ] Contact page: form stacks to single column on mobile
- [ ] Contact form field pairs (name/company, email/phone): stack on mobile
- [ ] Map iframe: reasonable height on mobile
- [ ] All pages: no horizontal scroll on any page at 375px viewport width
- [ ] `npm run build` passes in `af-web/`

### af-platform
- [ ] Mobile drawer: opens/closes smoothly, backdrop closes on click
- [ ] Topbar: hamburger visible on mobile, QuickSearch hidden on mobile
- [ ] Sidebar: close button present in mobile drawer, nav link tap closes drawer
- [ ] Desktop sidebar behaviour: completely unchanged
- [ ] Shipment list: card view renders on mobile, table renders on desktop
- [ ] Shipment list: status badge and route visible on mobile card
- [ ] Tab row: scrollable on mobile, no wrapping
- [ ] `npm run lint` passes in `af-platform/`
- [ ] `npm run build` passes in `af-platform/`

---

## Constraints

- Do NOT use any component library (no shadcn, no MUI). Pure Tailwind + inline styles as per existing patterns.
- Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) are preferred over JS window-width detection for layout switching.
- Do not change any data fetching, server actions, API calls, or business logic.
- Do not modify shipment detail page, task components, BL modal, or any other modals in this pass.
- Do not modify `af-server/` — this is frontend only.
- Preserve all existing animations (ticker, fadeUp, float, network SVG dots).
- The `legacy` link in the Navbar should remain visible and functional on mobile.
