# AcceleFreight — Status Codes & Field Defaults Registry
**Generated:** 25 February 2026  
**Source:** Full Datastore query — 70,876 records across 21 Kinds  
**Purpose:** Definitive reference for all reads in the new Next.js system. Every field listed here requires a default value applied on read. Never assume a field exists or has a value.

---

## ⚠️ Open TODOs

| # | Kind | Issue | Dev Requirement Until Fixed |
|---|---|---|---|
| 1 | `PortShipmentTasks` | `tax_charge` and `duty_charge` stored as mixed types (int / float / str). Target type is `float`. | All reads use `parseFloat()`. All writes use `float`. |
| 2 | `CompanyUserAccount` | 54% of records missing `company_id` and `company_key`. Company ↔ user relationships partially broken. | Guard all reads with `?? null`. Degrade gracefully. Flag features that depend on this relationship. |
| 3 | `ShipmentOrder.status` | Status codes `100`, `110`, `4110`, `10000` confirmed but labels for `4110` and intermediate states unconfirmed. | Do not build status-dependent UI until codes are verified against Vue source. |

---

## 1. Status Codes

### 1.1 Quotation.status
| Code | Meaning | Notes |
|---|---|---|
| `-1` | Cancelled / Rejected | Negative value = negative status. Confirmed. Handle explicitly — never treat as invalid data |
| `1001` | Draft | Not yet submitted |
| `1002` | Draft — Pending Review | Submitted draft, not yet confirmed |
| `2001` | Submitted | Awaiting quotation from AF |
| `2002` | Submitted — Revised | Re-submitted after revision |
| `3001` | Confirmed | Customer accepted the quotation |
| `4001` | Active | Shipment in progress |
| `4002` | Active — Exception | Active but flagged with an issue |
| `5001` | Completed | Shipment delivered, closed |

**Migration rule:** Status `-1` must never be filtered out — it is a valid terminal state, not corrupted data. Ensure UI renders a "Cancelled" state for this code.

---

### 1.2 ShipmentOrder.status
| Code | Meaning | Notes |
|---|---|---|
| `100` | Created | ShipmentOrder raised, not yet confirmed |
| `110` | Booking Confirmed | Carrier booking confirmed |
| `4110` | In Transit | Vessel/flight departed — **label unconfirmed, to be revised** |
| `10000` | Completed | Final state |

**TODO:** Confirm exact meaning of all ShipmentOrder status codes against the Vue codebase before building any status-dependent UI. Intermediate states between `110` and `4110` may exist.

**Migration rule:** Do not assume status codes increment sequentially.

---

### 1.3 Invoice.status
| Code | Meaning | Notes |
|---|---|---|
| `100` | Draft | Created, not yet sent to Xero |
| `200` | Submitted | Sent to Xero, awaiting authorisation |
| `2001` | Authorised | Approved in Xero |
| `3001` | Sent | Invoice emailed to customer |
| `4001` | Paid | Payment received — final state |

**Migration rule:** `status_msg` (string) mirrors this but comes from Xero webhook and may not always be in sync with the numeric `status`. Always treat the numeric `status` as authoritative for business logic. Use `status_msg` for display only.

---

### 1.4 UserAccount.status
`True` only — boolean. All 327 records are active. Inactive accounts may have been hard-deleted historically. Treat `status: false` as a deactivated account — do not expose to login flow.

---

## 2. Deprecated & Legacy Fields

Fields confirmed as old-records-only (not present in newest 20% of records). Read-safe but do not write.

| Kind | Field | Presence | Action |
|---|---|---|---|
| `QuotationFreight` | `air_schedule` | 17% (old only) | Read with default `null`. Superseded — do not write |
| `QuotationFreight` | `override_complete_price` | 0% | Effectively dead. Skip on read/write |
| `QuotationFCL` | `container_quantity` | 27% (old only) | Read with default `null`. Data moved to `containers` list |
| `QuotationFCL` | `container_size` | 27% (old only) | Read with default `null`. Data moved to `containers` list |
| `QuotationFCL` | `container_type` | 27% (old only) | Read with default `null`. Data moved to `containers` list |
| `QuotationFCL` | `old_actual_component` | 17% (old only) | Archival. Read with default `null`. Do not write |
| `ShipmentOrder` | `trash` | 8% (old only) | Soft-delete removed from this Kind. Default `false` on read |
| `Invoice` | `old_af_items` | 48% (old only) | Archival — read-only for historical invoice rendering |
| `Invoice` | `origin` | 34% (old only) | Tracking field removed. Default `null` |
| `UserIAM` | `active` | 17% (old only) | Superseded by `valid_access`. Default `false` on read |
| `Company` | `type` | 40% (old only) | Field removed. Default `'CUSTOMER'` on read |

---

## 3. Incrementally Added Fields (Absent on Old Records)

Fields added after the system launched. **Every read must apply the listed default.**

### Quotation
| Field | Present on | Default | Notes |
|---|---|---|---|
| `files` | 99.9% | `[]` | Empty list — missing on ~5 very old records |
| `quotation_closed` | 94.0% | `false` | Added mid-lifecycle. Absent on ~230 old records |

### QuotationFreight
| Field | Present on | Default | Notes |
|---|---|---|---|
| `is_domestic` | 98.5% | `false` | Added after launch |
| `hs_code` | 99.2% | `null` | Present but `null` on 95% — effectively always null |

### QuotationLCL & QuotationAir
| Field | Present on | Default | Notes |
|---|---|---|---|
| `export_transport_tonnage_rates` | 79% / 90% | `[]` | Tonnage rate data added later |
| `import_transport_tonnage_rates` | 79% / 90% | `[]` | Same |

### ShipmentOrder
| Field | Present on | Default | Notes |
|---|---|---|---|
| `quotation_freight_key` | 92.6% | `null` | Key ref — check for null before dereferencing |

### ShipmentWorkFlow
| Field | Present on | Default | Notes |
|---|---|---|---|
| `company_key` | 3.1% | `null` | Almost never present — do not rely on. Use `company_id` instead |

### Invoice
| Field | Present on | Default | Notes |
|---|---|---|---|
| `xero_sync_required` | 6.8% (new only) | `false` | Recently added. Only on newest records |

### Company
| Field | Present on | Default | Notes |
|---|---|---|---|
| `tags` | 99.7% | `[]` | Missing on ~2 records |
| `xero_sync_required` | 27.5% | `false` | Added mid-lifecycle |

### CompanyUserAccount
| Field | Present on | Default | Notes |
|---|---|---|---|
| `company_id` | 46.4% | `null` | Added later — half of records missing |
| `company_key` | 46.4% | `null` | Same — derive from `uid` lookup if null |

### UserAccount
| Field | Present on | Default | Notes |
|---|---|---|---|
| `last_login` | 70.3% | `null` | Not tracked for older accounts |
| `user` | 93.6% | `null` | Redundant email field — use `email` as primary |

### UserIAM
| Field | Present on | Default | Notes |
|---|---|---|---|
| `active` | 16.7% (old only) | `false` | Deprecated — use `valid_access` instead |

### UserDashboard
| Field | Present on | Default | Notes |
|---|---|---|---|
| `invoices` | 71.8% | `{}` | Not populated for all users |

### Comments
| Field | Present on | Default | Notes |
|---|---|---|---|
| `admin_notified` | 44.4% (new only) | `false` | Confirmed — added ~2021 |
| `customer_notified` | 44.4% (new only) | `false` | Confirmed — added ~2021 |

---

## 4. Nullable Fields (Present but None on Some Records)

Fields that exist on all records but carry `null` / `None` values for a portion of them. **Apply the listed default when value is null.**

### Quotation
| Field | Null on | Default |
|---|---|---|
| `other_services` | 94.4% | `null` — treat as "not applicable" |

### QuotationFreight
| Field | Null on | Default |
|---|---|---|
| `commodity` | 80.7% | `null` |
| `hs_code` | 95.1% | `null` |

### ShipmentOrder
| Field | Null on | Default | Notes |
|---|---|---|---|
| `container_discharge_from_vessel_date` | 100% | `null` | Always null — field reserved for future use |
| `container_unstuff_datetime` | 100% | `null` | Same |
| `last_status_updated` | 0.2% | `null` — fall back to `updated` | |

### Invoice
| Field | Null on | Default |
|---|---|---|
| `company_id` | 0.6% | `null` — derive from `company_key` if null |
| `expected_payment_date` | 20.7% | `null` |
| `paid_date` | 8.5% | `null` — only set when status = 4001 |

### Files
| Field | Null on | Default |
|---|---|---|
| `file_description` | 67.7% | `null` |
| `shipment_order_id` | 3.3% | `null` — files not attached to a shipment |

### Comments
| Field | Null on | Default |
|---|---|---|
| `invoice_id` | 100% | `null` — field reserved, never used |

### PortShipmentTasks
| Field | Null on | Default | Notes |
|---|---|---|---|
| `tax_charge` | 69.8% | `null` | ⚠️ TODO — Data cleanup: target type is `float`. Currently int, float, or string. All new writes must use `float`. Reads must normalise via `parseFloat()` |
| `duty_charge` | 69.8% | `null` | Same as above |
| `tax_duty_currency` | 74.2% | `null` | |

### Company
| Field | Null on | Default |
|---|---|---|
| `registration_number` | 58.0% | `null` |
| `preferred_currency` | 0.2% | `'MYR'` — safe default for Malaysian context |
| `xero_id` | 70.0% | `null` — not all companies are synced to Xero |
| `user` | 9.2% | `null` — early records had no owner assigned |

### CompanyRates
| Field | Null on | Default |
|---|---|---|
| `user` | 13.3% | `null` |

### UserAccount
| Field | Null on | Default |
|---|---|---|
| `phone_number` | 3.4% | `null` |

---

## 5. Type Inconsistencies Requiring Normalisation

Fields where the same field holds different types across records. Must be normalised on read.

| Kind | Field | Types found | Normalise to |
|---|---|---|---|
| `ShipmentOrder` | `last_status_updated` | `DatetimeWithNanoseconds`, `NoneType` | ISO string or `null` |
| `Invoice` | `expected_payment_date` | `DatetimeWithNanoseconds`, `NoneType` | ISO string or `null` |
| `Invoice` | `paid_date` | `DatetimeWithNanoseconds`, `NoneType` | ISO string or `null` |
| `PortShipmentTasks` | `tax_charge` | `int`, `float`, `str`, `NoneType` | `float` or `null` — **TODO cleanup** |
| `PortShipmentTasks` | `duty_charge` | `int`, `float`, `str`, `NoneType` | `float` or `null` — **TODO cleanup** |
| `Files` | `description` | `NoneType` only (0.4%) | Field essentially dead — ignore |

---

## 6. Structural Observations

### CompanyUserAccount — half the records are incomplete
`company_id` and `company_key` are only present on 46% of records. The current Vue system relies on these fields, meaning ~54% of those relationships are currently unresolvable via this Kind alone.

**⚠️ TODO — Relationship cleanup:** Evaluate on a case-by-case basis whether to repair the missing fields, remove orphaned records, or redefine the relationship. Given the small scale (323 records total), a full audit and repair pass is feasible. Until then:
- Always guard reads with `?? null`
- Do not hard-fail on missing `company_id` / `company_key` — log the gap and degrade gracefully
- Flag any feature that relies on company ↔ user lookup as requiring the CompanyUserAccount cleanup first

### ShipmentWorkFlow.company_key — almost never present (3.1%)
Use `company_id` string field instead for all company lookups from ShipmentWorkFlow.

### QuotationFCL — container fields migrated to containers list
`container_size`, `container_type`, `container_quantity` only present on old records (27%). Newer records store this data in the `containers` list field. On read: check `containers` list first; if empty and scalar fields exist, fall back to them for backward compatibility.

### Invoice.old_af_items — archival confirmed, read-only
Present on 48% (older records). Never write to this field. When rendering historical invoices for old records, use `old_af_items` if `af_line_items` is empty.

### Comments.invoice_id — 100% null, field reserved
Do not write to this field. It was intended for future use and never populated.

---

## 7. TypeScript Default Value Patterns

Reference implementation for the new Next.js system. Apply these patterns on every Datastore read.

```typescript
// Quotation
const quotation = {
  files:            entity.files            ?? [],
  quotation_closed: entity.quotation_closed ?? false,
  other_services:   entity.other_services   ?? null,
};

// QuotationFreight
const quotationFreight = {
  is_domestic:  entity.is_domestic  ?? false,
  hs_code:      entity.hs_code      ?? null,
  commodity:    entity.commodity    ?? null,
  air_schedule: entity.air_schedule ?? null,  // deprecated — read only
};

// QuotationLCL / QuotationAir
const quotationLCL = {
  export_transport_tonnage_rates: entity.export_transport_tonnage_rates ?? [],
  import_transport_tonnage_rates: entity.import_transport_tonnage_rates ?? [],
};

// QuotationFCL — container field migration
const containers = entity.containers?.length
  ? entity.containers
  : entity.container_size
    ? [{ size: entity.container_size, type: entity.container_type, quantity: entity.container_quantity }]
    : [];

// ShipmentOrder
const shipmentOrder = {
  quotation_freight_key:              entity.quotation_freight_key              ?? null,
  trash:                              entity.trash                              ?? false,
  container_discharge_from_vessel_date: entity.container_discharge_from_vessel_date ?? null,
  container_unstuff_datetime:         entity.container_unstuff_datetime         ?? null,
  last_status_updated:                entity.last_status_updated?.toISOString() ?? entity.updated ?? null,
};

// ShipmentWorkFlow
const workflow = {
  company_key: entity.company_key ?? null,  // use company_id for lookups instead
};

// Invoice
const invoice = {
  xero_sync_required:    entity.xero_sync_required    ?? false,
  company_id:            entity.company_id            ?? null,
  expected_payment_date: entity.expected_payment_date?.toISOString() ?? null,
  paid_date:             entity.paid_date?.toISOString()             ?? null,
  // Archival fallback for line items
  af_line_items: entity.af_line_items?.length
    ? entity.af_line_items
    : entity.old_af_items ?? [],
};

// Files
const file = {
  file_description: entity.file_description ?? null,
  shipment_order_id: entity.shipment_order_id ?? null,
};

// Comments
const comment = {
  admin_notified:    entity.admin_notified    ?? false,
  customer_notified: entity.customer_notified ?? false,
  invoice_id:        entity.invoice_id        ?? null,
};

// PortShipmentTasks — normalise mixed numeric types
const task = {
  tax_charge:      entity.tax_charge      != null ? parseFloat(entity.tax_charge)   : null,
  duty_charge:     entity.duty_charge     != null ? parseFloat(entity.duty_charge)  : null,
  tax_duty_currency: entity.tax_duty_currency ?? null,
};

// Company
const company = {
  tags:               entity.tags               ?? [],
  xero_sync_required: entity.xero_sync_required ?? false,
  registration_number: entity.registration_number ?? null,
  preferred_currency: entity.preferred_currency  ?? 'MYR',
  xero_id:            entity.xero_id             ?? null,
  user:               entity.user                ?? null,
  type:               entity.type                ?? 'CUSTOMER',  // deprecated field
};

// UserAccount
const userAccount = {
  last_login:   entity.last_login   ?? null,
  phone_number: entity.phone_number ?? null,
  user:         entity.user         ?? entity.email,  // fall back to email
};

// UserIAM
const userIAM = {
  active: entity.active ?? false,  // deprecated — prefer valid_access
};

// CompanyUserAccount
const companyUserAccount = {
  company_id:  entity.company_id  ?? null,
  company_key: entity.company_key ?? null,
};

// UserDashboard
const dashboard = {
  invoices: entity.invoices ?? {},
};
```

---

## 8. Summary — Field Risk Matrix

| Risk | Count | Examples |
|---|---|---|
| **Critical** — absent on >50% of records | 4 | `CompanyUserAccount.company_id/key`, `Comments.admin/customer_notified`, `UserIAM.active` |
| **High** — absent on 10–50% of records | 8 | `Quotation.quotation_closed`, `Invoice.old_af_items`, `UserAccount.last_login`, `Company.xero_sync_required` |
| **Medium** — null on >50% of records | 6 | `QuotationFreight.commodity/hs_code`, `Company.registration_number/xero_id`, `PortShipmentTasks.tax/duty_charge` |
| **Low** — null on <10% of records | 9 | `Invoice.paid_date`, `ShipmentOrder.last_status_updated`, `Company.preferred_currency`, etc. |
| **Deprecated** — old records only, do not write | 11 | See Section 2 |
| **Type inconsistency** — normalise on read | 5 | `PortShipmentTasks.tax_charge/duty_charge`, date fields |
