# PROMPT DRAFT — v3.03: Incoterm-Aware Status Logic + EXW Export Block

## Summary
Implement incoterm/transaction-type aware status initialisation and document-apply
auto-advance logic. Block EXW export from being a valid combination in the UI.

This affects: shipment creation, document apply endpoints, and the incoterm dropdown UI.

---

## Background / Business Logic

AcceleFreight's role in a shipment depends on who controls the freight. This determines:
1. Whether the "Booking" stage is meaningful
2. What status a new shipment should start at
3. How far to advance status when a document (BC/BL/AWB) is applied

### Incoterm Classification

**Booking stage RELEVANT** (AcceleFreight arranges/controls freight):
- EXW import, FOB import, FCA import
- CFR/CNF/CIF export, DDP export, DAP export, CPT export

**Booking stage NOT RELEVANT** (freight arranged by other party):
- FOB export, FCA export
- CNF/CFR/CIF import, DDP import, DAP import, CPT import

**BLOCKED combination** (should never exist):
- EXW export — hard block in UI

**Unclassified incoterms** (treat as relevant by default):
- Any incoterm not in the above lists

---

## Change 1 — Helper: `_is_booking_relevant(incoterm, transaction_type)`

Add to `af-server/routers/shipments/_helpers.py`:

```python
_BOOKING_NOT_RELEVANT = {
    # (incoterm_upper, transaction_type_upper)
    ("FOB", "EXPORT"),
    ("FCA", "EXPORT"),
    ("CNF", "IMPORT"),
    ("CFR", "IMPORT"),
    ("CIF", "IMPORT"),
    ("DDP", "IMPORT"),
    ("DAP", "IMPORT"),
    ("CPT", "IMPORT"),
}

def _is_booking_relevant(incoterm: str | None, transaction_type: str | None) -> bool:
    """Returns True if the Booking stage is meaningful for this shipment."""
    if not incoterm or not transaction_type:
        return True  # default to relevant if unknown
    key = (incoterm.upper(), transaction_type.upper())
    return key not in _BOOKING_NOT_RELEVANT
```

---

## Change 2 — Initial Status on Shipment Creation

In `af-server/routers/shipments/core.py` (or wherever `POST /shipments/` creates shipments),
use `_is_booking_relevant` to determine the initial status:

```python
from ._helpers import _is_booking_relevant

# Current initial status is always STATUS_CONFIRMED (2001) or STATUS_DRAFT
# New logic:
if _is_booking_relevant(body.incoterm_code, body.transaction_type):
    initial_status = STATUS_CONFIRMED  # 2001 — Booking Pending comes later manually
else:
    initial_status = STATUS_CONFIRMED  # 2001 — same starting point, Booking stage skipped in pipeline
```

Note: Both paths start at 2001 (Confirmed) on creation. The difference is in the STATUS
PIPELINE progression — the Booking (3001/3002) step is shown or hidden in the UI based
on `_is_booking_relevant`. This prompt does NOT change the status pipeline UI — that is a
separate frontend task. This prompt only handles auto-advance on document apply.

---

## Change 3 — Auto-Advance on Document Apply

### `apply_booking_confirmation` (`doc_apply.py`)
Already advancing to STATUS_BOOKING_CONFIRMED (3002) from v3.02.
No change needed here — BC apply always means booking is confirmed.

### `PATCH /shipments/{id}/bl` (`bl.py`)
When BL is applied to an existing shipment, auto-advance status based on incoterm:

```python
# After successful BL apply, determine status advancement
from ._helpers import _is_booking_relevant, _determine_initial_status

incoterm = row_incoterm  # read from shipment row
transaction_type = row_transaction_type

if not _is_booking_relevant(incoterm, transaction_type):
    # Import side, freight not ours — advance to Departed if already shipped, else Booking Confirmed
    on_board_date = body_etd or parsed_on_board_date  # use ETD from BL
    new_status = _determine_initial_status(on_board_date)  # returns 4001 if past, 3002 if future
    # Update status + append to status_history
    conn.execute(text("UPDATE shipments SET status = :s WHERE id = :id"), ...)
else:
    # Booking relevant — advance to Booking Confirmed
    new_status = STATUS_BOOKING_CONFIRMED  # 3002
    conn.execute(text("UPDATE shipments SET status = :s WHERE id = :id"), ...)
```

### `apply_awb` (`doc_apply.py`)
Same logic as BL apply — read incoterm + transaction_type from shipment row, determine
advancement using `_is_booking_relevant` + `_determine_initial_status(flight_date)`.

---

## Change 4 — EXW Export Hard Block (Frontend)

In the incoterm dropdown component used during shipment creation and edit:

File: `af-platform/src/components/shipments/` — find the incoterm selector component
(likely in the New Shipment modal or an edit modal).

When `transaction_type === 'EXPORT'`, filter out `EXW` from the available incoterm options:

```typescript
const availableIncoterms = incoterms.filter(i => {
  if (transactionType === 'EXPORT' && i.code === 'EXW') return false;
  return true;
});
```

If EXW is already selected and the user changes transaction_type to EXPORT, clear the
incoterm field and show a validation message: "EXW is not valid for export shipments."

---

## Files to Modify

### Backend
- `af-server/routers/shipments/_helpers.py` — add `_BOOKING_NOT_RELEVANT` set + `_is_booking_relevant()`
- `af-server/routers/shipments/bl.py` — add status auto-advance in `PATCH /{id}/bl`
- `af-server/routers/shipments/doc_apply.py` — add status auto-advance in `apply_awb`

### Frontend
- Find and update the incoterm dropdown/selector component — filter EXW from EXPORT options

## Do NOT Modify
- Status pipeline UI (Booking node show/hide is a separate task)
- `apply_booking_confirmation` (handled in v3.02)
- `create-from-bl` endpoint (already uses `_determine_initial_status`)
- Any test files or existing status history logic

## API Contract Impact
- `PATCH /shipments/{id}/bl` — response should include `new_status` in data object
- `POST /shipments/{id}/apply-awb` — response should include `new_status` in data object
- `POST /shipments/{id}/apply-booking-confirmation` — already returns status OK (v3.02)
- Section 2.7 status paths need updating — Path A/B definition to be revised
