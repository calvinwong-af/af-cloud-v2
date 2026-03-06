# GT — Ground Transport Tests

## GT-01: Actions Menu Display
| # | Test | Expected | Status |
|---|---|---|---|
| GT-01 | Actions menu (⋯) renders for AFU users on GT list | ⋯ button visible on each row | YES |
| GT-02 | Actions menu does not render for non-AFU users | No ⋯ button visible | PENDING |
| GT-03 | Clicking ⋯ opens dropdown menu | Dropdown appears above all other elements (no clipping) | YES |
| GT-04 | Clicking outside closes dropdown | Menu dismisses on outside click | YES |

## GT-02: Soft Delete (Move to Trash)
| # | Test | Expected | Status |
|---|---|---|---|
| GT-05 | "Move to Trash" option appears in menu for non-trash orders | Option visible | YES |
| GT-06 | Soft delete removes order from list | Order disappears from GT list after move to trash | YES |

## GT-03: Hard Delete (Permanent)
| # | Test | Expected | Status |
|---|---|---|---|
| GT-07 | "Delete Permanently" appears for draft/cancelled orders | Option visible in menu | YES |
| GT-08 | Hard delete requires window.confirm | Confirmation dialog shown before deletion | YES |
| GT-09 | Confirming hard delete removes order permanently | Order gone from list; does not reappear on refresh | YES |

## GT-04: is_test Flag
| # | Test | Expected | Status |
|---|---|---|---|
| GT-10 | is_test checkbox appears on CreateGroundTransportModal for AFU users | Checkbox visible, default unchecked | PENDING |
| GT-11 | Creating GT order with is_test checked shows TEST badge on list | TEST badge appears on row | PENDING |
| GT-12 | is_test checkbox appears on StepReview (shipment create) for AFU users | Checkbox visible, default unchecked | PENDING |
| GT-13 | Creating shipment with is_test checked saves correctly | is_test = true in DB | PENDING |
