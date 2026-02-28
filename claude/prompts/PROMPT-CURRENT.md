# PROMPT — AFC Permission Fixes: Dashboard + Shipment Detail + Tasks
**Session:** v2.25 (continued)
**Date:** 01 Mar 2026
**Priority:** Security / correctness

---

## Context

AFC customer accounts (e.g. wongyuenfatt@gmail.com, role=AFC-ADMIN, company=AFC-0005)
are now correctly scoped to their company's shipments following the v2.25 auth fix.
However, several UI elements remain unguarded and expose staff-only actions to customers.
This prompt fixes all five open issues identified in the AFC testing session.

Read `AF-Coding-Standards.md` and `CLAUDE.md` before starting.

---

## Fix 1 — Dashboard: replace "Total Companies" KPI for AFC users

**File:** `af-platform/src/app/(platform)/dashboard/page.tsx`

The dashboard currently calls `fetchCompanyStatsAction()` unconditionally and renders
a "Total Companies" KPI card for all users. AFC users have no business seeing global
company counts — they should see their own company info instead.

### Changes:

**1a. Skip `fetchCompanyStatsAction` for AFC users**

`accountType` is already fetched from `getCurrentUserProfileAction()` in the same
`Promise.all`. Move the company stats fetch to be conditional:

```typescript
const [shipmentStatsResult, ordersResult, profile] = await Promise.all([
  fetchShipmentOrderStatsAction(),
  fetchShipmentOrdersAction({ limit: 10 }),
  getCurrentUserProfileAction(),
]);

// Only fetch company stats for AFU users
const companyStatsResult = profile.account_type === 'AFU'
  ? await fetchCompanyStatsAction()
  : { success: true as const, data: null };
```

Adjust error handling to only throw on company stats failure for AFU users.

**1b. Conditional KPI grid**

For AFU users: render 4 cards as today (Total Shipments, Active, Total Companies,
To Invoice).

For AFC users: render 4 cards replacing "Total Companies" with a "My Company" card:
- Icon: `Building2`
- Label: `"My Company"`
- Value: the user's `company_name` from `getCurrentUserProfileAction()` (already
  extended in v2.25 to return this)
- If company_name is null/empty, fall back to `company_id`
- Color: `"purple"` (matching existing KpiCard color prop)

`getCurrentUserProfileAction()` now returns `company_name` and `company_id` — use
those directly; no additional fetch needed.

**1c. KpiCard — support string values**

`KpiCard` currently types `value` as `number | string`. Confirm it renders string
values correctly (it should — just verify and don't change if already working).

---

## Fix 2 — Shipment detail: hide staff-only status actions from AFC users

**File:** `af-platform/src/app/(platform)/shipments/[id]/page.tsx`

Inside `StatusCard`, the action buttons area currently only checks `isTerminal`.
AFC users can see and click Advance, Cancel, and Flag Exception buttons.

### Changes:

**2a. Guard all action buttons behind `isAfu`**

The existing `isAfu` flag (`const isAfu = accountType === 'AFU'`) is already defined
in `StatusCard`. Wrap the entire action buttons block:

```tsx
{/* Action Buttons — AFU only */}
{isAfu && !isTerminal && (
  <div className="flex items-center gap-2 flex-wrap">
    {/* Advance button */}
    {advanceStatus && ( ... )}
    {/* Exception flag/clear button */}
    <button onClick={handleExceptionToggle} ...>...</button>
    {/* Cancel button */}
    {canCancel && ( <button onClick={handleCancelClick} ...>...</button> )}
  </div>
)}
```

AFC users see the status timeline (read-only view is fine) but no action buttons.

**2b. Guard the Invoiced toggle behind `isAfu`**

The invoiced toggle section at the bottom of `StatusCard` should also be AFU-only.
Wrap it:

```tsx
{/* Invoiced Toggle — AFU only */}
{isAfu && (
  <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between">
    ...existing toggle...
  </div>
)}
```

**2c. Status history — keep visible for both AFC and AFU**

The status history accordion should remain visible to AFC users (read-only). No change
needed there.

**2d. Node click handlers — tighten AFC guard**

`handlePastClick` already has `if (loading || !isAfu) return` — correct.
`handleFutureNodeClick` has no `isAfu` check — AFC users can click future nodes.

Add an `isAfu` guard at the top of `handleFutureNodeClick`:

```typescript
function handleFutureNodeClick(...) {
  if (loading || isTerminal || !isAfu) return;
  ...
}
```

And in the node `onClick` handler, the cursor class already uses `isAfu` for past
nodes — extend it for future nodes too:

```typescript
const nodeCursor =
  state === 'future' && isAfu ? 'cursor-pointer' :
  state === 'past' && isAfu ? 'cursor-pointer' :
  currentIncomplete && isAfu ? 'cursor-pointer' :
  'cursor-default';
```

---

## Fix 3 — Tasks: restrict Mode selector to AFU only

**File:** `af-platform/src/components/shipments/ShipmentTasks.tsx`

`canChangeMode()` currently returns `true` for `AFC-ADMIN` and `AFC-M`. The task
mode (ASSIGNED / TRACKED / IGNORED) is an internal operations setting — customers
should not be able to change it.

### Change:

```typescript
function canChangeMode(accountType: string | null): boolean {
  return accountType === 'AFU';
}
```

Remove the `userRole` parameter entirely from `canChangeMode` — it is no longer
needed. Update all call sites accordingly (there is one call in `EditTaskModal`
and the function signature definition).

AFC users with AFC-ADMIN or AFC-M roles can still edit task timing, status, notes,
and assigned_to — only the Mode selector is hidden from them.

Note: `canEdit()` intentionally keeps AFC-ADMIN and AFC-M as editable — this is
correct. Only mode-changing is restricted.

---

## Verification checklist

- [ ] AFC user dashboard shows "My Company" card (Universal Zentury Holdings Sdn Bhd) instead of "628 Total Companies"
- [ ] AFC user dashboard — no error thrown from company stats fetch
- [ ] AFU user dashboard unchanged — still shows Total Companies count
- [ ] AFC user on shipment detail — Advance/Cancel/Flag Exception buttons hidden
- [ ] AFC user on shipment detail — Invoiced toggle hidden
- [ ] AFC user on shipment detail — Status timeline visible (read-only, no cursor-pointer on nodes)
- [ ] AFC user on shipment detail — Status History accordion still visible and expandable
- [ ] AFC user on Tasks tab — Edit modal opens but Mode selector (ASSIGNED/TRACKED/IGNORED) is hidden
- [ ] AFU user — all existing behaviour unchanged
- [ ] `npm run lint` passes in `af-platform`
- [ ] No TypeScript errors
