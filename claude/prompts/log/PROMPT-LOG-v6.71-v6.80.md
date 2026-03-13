## Prompt Log — v6.71 to v6.80

### [2026-03-14 23:15 UTC] — v6.72: DG Class Charges Frontend Rewrite (Two-Tier Schema)
- **Status:** Completed
- **Tasks:**
  - A: Added `card_id` to dg_class_charges.py `/cards` response
  - B: Added `card_id` to `DgClassChargeCard` interface, added `updateDgClassChargeCardAction`, tightened `updateDgClassChargeAction` to rate-only fields
  - C: Full rewrite of `_dg-class-charges-modal.tsx` with 3 modes (new, edit-rate, edit-card), exported `DgClassChargeModalSeed` and `DgClassChargeModalPayload` types, badge helpers for edit-rate header
  - D: Full rewrite of `_dg-class-charges-table.tsx` — `buildCardSeed` helper, Info button for edit-card, INTL before DOM badges, preserved `dgClassBadge`/`dgClassFilter`/`FlaskConical`, updated `onAction` signature to `(seed, mode)`, modal wired with payload dispatch
- **Files Modified:**
  - `af-server/routers/pricing/dg_class_charges.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-modal.tsx`
  - `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-table.tsx`
- **Notes:** Final module in the three-module frontend rewrite series (customs v6.70, local charges v6.71, DG class v6.72). All py_compile and ESLint checks passed.

### [2026-03-14 22:45 UTC] — v6.71: Local Charges Frontend Rewrite (Two-Tier Schema)
- **Status:** Completed
- **Tasks:**
  - A: Added `card_id` to local_charges.py `/cards` response
  - B: Added `card_id` to `LocalChargeCard` interface, added `updateLocalChargeCardAction`, tightened `updateLocalChargeAction` to rate-only fields
  - C: Full rewrite of `_local-charges-modal.tsx` with 3 modes (new, edit-rate, edit-card), exported `LocalChargeModalSeed` and `LocalChargeModalPayload` types, added container_size/container_type/dg_class_code fields in edit-card mode
  - D: Full rewrite of `_local-charges-table.tsx` — `buildCardSeed` helper, Info button for edit-card, INTL/DOM badges (INTL before DOM), DG class badge, updated `onAction` signature to `(seed, mode)`, updated modal JSX to use `LocalChargesModal` with payload pattern
- **Files Modified:**
  - `af-server/routers/pricing/local_charges.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-modal.tsx`
  - `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx`
- **Notes:** Mirrors v6.70 customs pattern. All py_compile and ESLint checks passed.
