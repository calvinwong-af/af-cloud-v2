# AcceleFreight — AF Server V2 API Contract Index
**Base URL:** `https://af-server-667020632236.asia-northeast1.run.app/api/v2` (prod) · `http://localhost:8000/api/v2` (local)  
**Auth:** Firebase ID token — `Authorization: Bearer <token>` on all protected routes  
**Version:** Contract v2.0 — 12 March 2026  
**Status:** Living document — update when endpoints change

---

## Files in This Contract

| File | Sections | Contents |
|---|---|---|
| `AF-API-Index.md` | 0, 1, 12 | Conventions, Health, Auth Dependency Map |
| `AF-API-Shipments.md` | 2, 9 | Shipments + shared data objects |
| `AF-API-Companies-Users.md` | 3, 4 | Companies, Users |
| `AF-API-Geography.md` | 5, 6 | Geography, Legacy Ports |
| `AF-API-AI-Files.md` | 7, 8 | Files (stub), AI parse |
| `AF-API-Ground-Transport.md` | 10 | Ground Transport orders, stops, legs, geocoding |
| `AF-API-Pricing.md` | 11, 13 | Pricing — FCL, LCL, Haulage, Air; Open Items |

---

## 0. Conventions

### 0.1 Response Envelope

All endpoints return a standard JSON envelope:

```json
{
  "status": "OK" | "ERROR",
  "data": <payload>,
  "msg": "Human-readable message"
}
```

List endpoints may omit the envelope in favour of a direct array or named top-level keys (see per-endpoint notes). This will be standardised in a future pass — for now, document the actual shape.

### 0.2 Error Responses

| HTTP Code | Meaning |
|---|---|
| `400` | Bad request — validation failed |
| `401` | Missing or expired token |
| `403` | Authenticated but forbidden (wrong role) |
| `404` | Resource not found |
| `500` | Server error |

Error body:
```json
{ "detail": "Human-readable error message" }
```

### 0.3 Auth Roles

| Role token | Who | Permissions |
|---|---|---|
| `require_auth` | Any authenticated user | Read own data |
| `require_afu` | AFU staff (any AFU role) | Read all data |
| `require_afu_admin` | AFU-ADMIN only | Write / create / delete |
| `require_super_admin` | Named super-admins only (calvin, isaac) | Dangerous ops |

**AFU Roles:** `AFU-ADMIN` · `AFU-STAFF` · `AFU-OPS`  
**AFC Roles:** `AFC-ADMIN` · `AFC-M` (Manager)

AFC users (`is_afc()`) are automatically scoped to their own `company_id` — they can never see data from other companies regardless of which endpoint they call.

### 0.4 ID Formats

| Prefix | Entity | Example |
|---|---|---|
| `AF-XXXXXX` | V2 Shipment | `AF-003873` |
| `AFCQ-XXXXXX` | V1 Shipment (migrated) | `AFCQ-003780` — resolves to `AF-003780` |
| `AFC-XXXXXX` | Company | `AFC-000412` |
| `INV-XXXXXX` | Invoice | `INV-000658` |

AFCQ- IDs are accepted transparently at the shipment endpoints — the server resolves them to the migrated AF- record.

### 0.5 Date/Datetime Format

All datetimes are ISO 8601 UTC strings: `"2026-02-28T10:32:00+00:00"`.  
Date-only fields (`cargo_ready_date`, `etd`, `eta`) are `"YYYY-MM-DD"` strings.

---

## 1. Health

### `GET /`
No auth. Used by Cloud Run health checks.

**Response:**
```json
{ "status": "OK", "version": "2.0.0", "service": "af-server" }
```

---

## 12. Auth Dependency Map

| Endpoint | Auth |
|---|---|
| `GET /` | None |
| `GET /ports` | None |
| `GET /ports/{code}` | None |
| `GET /geography/ports` | `require_auth` |
| `GET /geography/ports/{code}` | `require_auth` |
| `PATCH /geography/ports/{code}` | `require_afu` |
| `GET /geography/states` | `require_auth` |
| `GET /geography/states/{code}` | `require_auth` |
| `GET /geography/cities` | `require_auth` |
| `GET /geography/cities/{city_id}` | `require_auth` |
| `POST /geography/cities` | `require_afu` |
| `PATCH /geography/cities/{city_id}` | `require_afu` |
| `GET /geography/areas` | `require_auth` |
| `GET /geography/areas/{area_id}` | `require_auth` |
| `POST /geography/areas` | `require_afu` |
| `PATCH /geography/areas/{area_id}` | `require_afu` |
| `DELETE /geography/areas/{area_id}` | `require_afu` |
| `POST /geography/ports/resolve` | `require_afu` |
| `POST /geography/ports/confirm` | `require_afu` |
| `GET /geography/countries` | `require_auth` |
| `GET /geography/countries/{code}` | `require_auth` |
| `PATCH /geography/countries/{code}` | `require_afu` |
| `GET /geography/port-terminals` | `require_auth` |
| `GET /geography/port-terminals/{terminal_id}` | `require_auth` |
| `GET /shipments/stats` | `require_auth` |
| `GET /shipments/search` | `require_auth` |
| `GET /shipments/` | `require_auth` |
| `GET /shipments/file-tags` | `require_auth` |
| `GET /shipments/{id}` | `require_auth` |
| `GET /shipments/{id}/status-history` | `require_auth` |
| `GET /shipments/{id}/files` | `require_auth` |
| `GET /shipments/{id}/tasks` | `require_auth` |
| `GET /shipments/{id}/route-nodes` | `require_auth` |
| `GET /shipments/{id}/files/{fid}/download` | `require_auth` |
| `POST /shipments/` | `require_afu_admin` |
| `DELETE /shipments/{id}` | `require_afu_admin` |
| `PATCH /shipments/{id}/cargo` | `require_afu_admin` |
| `PATCH /shipments/{id}/status` | `require_afu` |
| `PATCH /shipments/{id}/complete` | `require_afu` |
| `PATCH /shipments/{id}/invoiced` | `require_afu` |
| `PATCH /shipments/{id}/incoterm` | `require_afu` |
| `PATCH /shipments/{id}/port` | `require_afu` |
| `PATCH /shipments/{id}/company` | `require_afu` |
| `PATCH /shipments/{id}/booking` | `require_afu` |
| `PATCH /shipments/{id}/type-details` | `require_afu` |
| `PATCH /shipments/{id}/bl` | `require_afu` |
| `PATCH /shipments/{id}/parties` | `require_afu` |
| `PATCH /shipments/{id}/clear-parsed-diff` | `require_afu` |
| `POST /shipments/{id}/apply-booking-confirmation` | `require_afu` |
| `POST /shipments/{id}/apply-awb` | `require_afu` |
| `POST /shipments/{id}/save-document-file` | `require_afu` |
| `POST /shipments/parse-bl` | `require_afu` |
| `POST /shipments/create-from-bl` | `require_afu` |
| `PATCH /shipments/{id}/exception` | `require_auth` (AFC role-gated internally) |
| `POST /shipments/{id}/files` | `require_auth` (AFC role-gated internally) |
| `PATCH /shipments/{id}/files/{fid}` | `require_auth` (AFC role-gated internally) |
| `PATCH /shipments/{id}/tasks/{tid}` | `require_auth` (AFC role-gated internally) |
| `PUT /shipments/{id}/route-nodes` | `require_auth` (AFC role-gated internally) |
| `PATCH /shipments/{id}/route-nodes/{seq}` | `require_auth` (AFC role-gated internally) |
| `DELETE /shipments/{id}/files/{fid}` | `require_afu` |
| `GET /companies` | `require_afu` |
| `GET /companies/stats` | `require_afu` |
| `GET /companies/{id}` | `require_auth` |
| `POST /companies` | `require_afu_admin` |
| `PATCH /companies/{id}` | `require_afu` |
| `GET /users/me` | `require_auth` |
| `GET /users` | `require_afu_admin` |
| `POST /users` | `require_afu_admin` |
| `PATCH /users/{uid}` | `require_afu_admin` |
| `DELETE /users/{uid}` | `require_afu_admin` |
| `POST /users/{uid}/reset-password` | `require_afu_admin` |
| `POST /users/{uid}/send-reset-email` | `require_afu_admin` |
| `PATCH /users/{uid}/promote-to-staff` | `require_afu_admin` |
| `POST /ai/parse-document` | `require_auth` |
| `GET /ground-transport/vehicle-types` | `require_afu` |
| `POST /ground-transport` | `require_afu` |
| `GET /ground-transport` | `require_afu` |
| `GET /ground-transport/{order_id}` | `require_afu` |
| `PATCH /ground-transport/{order_id}` | `require_afu` |
| `DELETE /ground-transport/{order_id}` | `require_afu` |
| `POST /ground-transport/{order_id}/stops` | `require_afu` |
| `PATCH /ground-transport/{order_id}/stops/{stop_id}` | `require_afu` |
| `PATCH /ground-transport/{order_id}/legs/{leg_id}` | `require_afu` |
| `GET /ground-transport/shipment/{shipment_id}/reconcile` | `require_afu` |
| `PATCH /ground-transport/shipment/{shipment_id}/scope` | `require_afu` |
| `GET /ground-transport/geocode/autocomplete` | `require_afu` |
| `GET /ground-transport/geocode/place` | `require_afu` |
| `GET /ground-transport/geocode` | `require_afu` |
| `GET /pricing/fcl/rate-cards` | `require_afu` |
| `GET /pricing/fcl/rate-cards/{card_id}` | `require_afu` |
| `POST /pricing/fcl/rate-cards` | `require_afu_admin` |
| `PATCH /pricing/fcl/rate-cards/{card_id}` | `require_afu_admin` |
| `GET /pricing/fcl/rate-cards/{card_id}/rates` | `require_afu` |
| `POST /pricing/fcl/rate-cards/{card_id}/rates` | `require_afu_admin` |
| `PATCH /pricing/fcl/rates/{rate_id}` | `require_afu_admin` |
| `DELETE /pricing/fcl/rates/{rate_id}` | `require_afu_admin` |
| `GET /pricing/lcl/rate-cards` | `require_afu` |
| `GET /pricing/lcl/rate-cards/{card_id}` | `require_afu` |
| `POST /pricing/lcl/rate-cards` | `require_afu_admin` |
| `PATCH /pricing/lcl/rate-cards/{card_id}` | `require_afu_admin` |
| `GET /pricing/lcl/rate-cards/{card_id}/rates` | `require_afu` |
| `POST /pricing/lcl/rate-cards/{card_id}/rates` | `require_afu_admin` |
| `PATCH /pricing/lcl/rates/{rate_id}` | `require_afu_admin` |
| `DELETE /pricing/lcl/rates/{rate_id}` | `require_afu_admin` |
| `GET /pricing/haulage/rate-cards` | `require_afu` |
| `GET /pricing/haulage/rate-cards/{card_id}` | `require_afu` |
| `POST /pricing/haulage/rate-cards` | `require_afu_admin` |
| `PATCH /pricing/haulage/rate-cards/{card_id}` | `require_afu_admin` |
| `GET /pricing/haulage/rate-cards/{card_id}/rates` | `require_afu` |
| `POST /pricing/haulage/rate-cards/{card_id}/rates` | `require_afu_admin` |
| `PATCH /pricing/haulage/rates/{rate_id}` | `require_afu_admin` |
| `DELETE /pricing/haulage/rates/{rate_id}` | `require_afu_admin` |
| `POST /pricing/haulage/rates/{rate_id}/publish` | `require_afu_admin` |
| `POST /pricing/haulage/rates/{rate_id}/reject` | `require_afu_admin` |
| `GET /pricing/haulage/depot-gate-fees` | `require_afu` |
| `GET /pricing/haulage/depot-gate-fees/active` | `require_afu` |
| `POST /pricing/haulage/depot-gate-fees` | `require_afu_admin` |
| `PATCH /pricing/haulage/depot-gate-fees/{fee_id}` | `require_afu_admin` |
| `DELETE /pricing/haulage/depot-gate-fees/{fee_id}` | `require_afu_admin` |
| `GET /pricing/haulage/supplier-rebates` | `require_afu` |
| `POST /pricing/haulage/supplier-rebates` | `require_afu` |
| `PATCH /pricing/haulage/supplier-rebates/{rebate_id}` | `require_afu` |
| `DELETE /pricing/haulage/supplier-rebates/{rebate_id}` | `require_afu` |
| `GET /pricing/haulage/faf-rates` | `require_afu` |
| `POST /pricing/haulage/faf-rates` | `require_afu` |
| `PATCH /pricing/haulage/faf-rates/{faf_id}` | `require_afu` |
| `DELETE /pricing/haulage/faf-rates/{faf_id}` | `require_afu` |
| `GET /pricing/air/rate-cards` | `require_afu` |
| `GET /pricing/air/rate-cards/{card_id}` | `require_afu` |
| `POST /pricing/air/rate-cards` | `require_afu_admin` |
| `PATCH /pricing/air/rate-cards/{card_id}` | `require_afu_admin` |
| `GET /pricing/air/rate-cards/{card_id}/rates` | `require_afu` |
| `POST /pricing/air/rate-cards/{card_id}/rates` | `require_afu_admin` |
| `PATCH /pricing/air/rates/{rate_id}` | `require_afu_admin` |
| `DELETE /pricing/air/rates/{rate_id}` | `require_afu_admin` |
| `POST /pricing/air/rates/{rate_id}/publish` | `require_afu_admin` |
| `POST /pricing/air/rates/{rate_id}/reject` | `require_afu_admin` |
| `GET /pricing/air/list-price-cards` | `require_afu` |
| `POST /pricing/air/list-price-cards` | `require_afu_admin` |
| `PATCH /pricing/air/list-price-cards/{card_id}` | `require_afu_admin` |
| `GET /pricing/air/list-price-cards/{card_id}/rates` | `require_afu` |
| `POST /pricing/air/list-price-cards/{card_id}/rates` | `require_afu_admin` |
| `PATCH /pricing/air/list-price-rates/{rate_id}` | `require_afu_admin` |
| `DELETE /pricing/air/list-price-rates/{rate_id}` | `require_afu_admin` |
| `POST /pricing/air/list-price-rates/{rate_id}/publish` | `require_afu_admin` |
| `POST /pricing/air/rate-cards/{card_id}/resolve` | `require_afu` |

---

*Last updated: 12 March 2026 — Contract v2.0*
