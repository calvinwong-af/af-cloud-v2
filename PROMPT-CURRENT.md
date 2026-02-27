# Fix: updateInvoicedStatus — V1 dual-write

## Context
File: `af-platform/src/lib/shipments-write.ts`
Function: `updateInvoicedStatus`

## Problem
The function currently only writes `issued_invoice` to the `Quotation` Kind.

However, for V1 records (prefix `AFCQ-`), the stats endpoint and list endpoint in `af-server/routers/shipments.py` read `issued_invoice` from **ShipmentOrder**, not Quotation. This means toggling a V1 shipment's invoice status updates Quotation but the server-side count and To Invoice tab still see the old value from ShipmentOrder — so the badge and list are inconsistent.

## Required Fix
In `updateInvoicedStatus`, after the `ds.merge()` on Quotation:
- Check if `shipment_id` starts with `AFCQ-` (V1 record)
- If yes, also write `issued_invoice` to the `ShipmentOrder` entity with the same shipment_id

## Implementation Notes
- Use `ds.merge()` for both writes (non-destructive partial update)
- For ShipmentOrder write, also update `updated: now`
- Wrap in try/catch — ShipmentOrder may not exist for very old records, don't fail the whole operation if SO write fails (log a warning instead)
- The Quotation write should always happen regardless of V1/V2

## Example Structure
```typescript
// Always write to Quotation
await ds.merge({ key: quotationKey, data: { issued_invoice, updated: now } });

// For V1: also write to ShipmentOrder
if (input.shipment_id.startsWith('AFCQ-')) {
  try {
    const soKey = ds.key(['ShipmentOrder', input.shipment_id]);
    await ds.merge({ key: soKey, data: { issued_invoice: input.issued_invoice, updated: now } });
  } catch (soErr) {
    console.warn('[updateInvoicedStatus] Could not write to ShipmentOrder:', soErr);
  }
}
```

## Files to modify
- `af-platform/src/lib/shipments-write.ts` — `updateInvoicedStatus` function only

No other files need to change.
