# AF API Contract — Files & AI (Sections 7 & 8)
*See AF-API-Index.md for conventions, auth roles, and auth map.*

---

## 7. Files

Base path: `/api/v2/files`  
**Status:** Stub only — `GET /files/upload-url` returns `null`. All active file operations are under `/shipments/{id}/files`.

---

## 8. AI

Base path: `/api/v2/ai`

### `POST /ai/parse-document`
Auth: `require_auth`

General-purpose freight document parser. Accepts a base64-encoded PDF and an optional hint. Classifies the document then extracts structured fields in a single response. Unlike `POST /shipments/parse-bl`, this endpoint uses async Claude API calls and accepts base64 input (not multipart). Intended for use by the af-platform's document upload modal.

**Request body:**
```json
{
  "file_base64": "<base64 encoded PDF>",
  "file_name": "HBL_001.pdf",
  "hint": "BL"
}
```

`hint` is optional. Values: `"BL"` | `"AWB"` | `"BOOKING_CONFIRMATION"`. If provided, skips the classification step.

**Response:**
```json
{
  "status": "OK",
  "doc_type": "BL",
  "confidence": "HIGH",
  "data": {
    "waybill_number": "COSCO12345678",
    "booking_number": null,
    "carrier_agent": "COSCO Shipping Lines",
    "vessel_name": "CSCL GLOBE",
    "voyage_number": "V0123",
    "port_of_loading": "Ho Chi Minh City",
    "port_of_discharge": "Port Klang",
    "on_board_date": "2026-03-10",
    "freight_terms": "PREPAID",
    "shipper_name": "Supplier Vietnam Ltd",
    "shipper_address": "...",
    "consignee_name": "Acme Corp Sdn Bhd",
    "consignee_address": "...",
    "notify_party_name": null,
    "cargo_description": "Electronic Components",
    "total_weight_kg": 5000.0,
    "total_packages": "20 PALLETS",
    "delivery_status": null,
    "containers": [
      {
        "container_number": "COSCU1234567",
        "container_type": "40HC",
        "seal_number": "SL001",
        "packages": "20",
        "weight_kg": 5000.0
      }
    ],
    "cargo_items": null,
    "pol_code": "VNSGN",
    "pod_code": "MYPKG"
  }
}
```

**doc_type values:** `BL` | `AWB` | `BOOKING_CONFIRMATION` | `UNKNOWN`  
**confidence values:** `HIGH` | `MEDIUM` | `LOW`

For `AWB`, `data` contains AWB-specific fields: `awb_type`, `hawb_number`, `mawb_number`, `origin_iata`, `dest_iata`, `flight_number`, `flight_date`, `pieces`, `gross_weight_kg`, `chargeable_weight_kg`.  
For `BOOKING_CONFIRMATION`, `data` contains BC fields: `booking_reference`, `carrier`, `pol_name`, `pol_code`, `pod_name`, `pod_code`, `etd`, `eta_pol`, `eta_pod`, `cut_off_date`, `containers`.  
For `UNKNOWN`, `data` is `{}`.

Port codes (`pol_code`, `pod_code`) are resolved from the `ports` table where possible (non-fatal — omitted if resolution fails).

**Errors:**
- `503` — Claude API timeout (retry)
- `500` — `ANTHROPIC_API_KEY` not configured
- `{"status": "ERROR", ...}` — Claude returned invalid JSON (soft error, not HTTP 4xx)
