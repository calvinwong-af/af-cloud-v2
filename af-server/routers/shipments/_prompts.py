"""
routers/shipments/_prompts.py

AI prompt string constants used by the document parsing endpoints.
No imports required — pure string constants.
"""

_BL_EXTRACTION_PROMPT = """You are extracting structured data from a Bill of Lading or Sea Waybill.
Return ONLY valid JSON, no preamble, no markdown, no code fences.
Use null for any field not present.

CONTAINER RULES — follow strictly:
- FCL shipments: each container has its own BL line with individual container numbers, types, and seals. Put these in the containers array. Set lcl_container_number and lcl_seal_number to null.
- LCL shipments: cargo is consolidated into a shared box. The BL shows cargo line items (pallets, cartons) but the container number belongs to the consolidation box managed by the freight forwarder. Put the consolidation container number in lcl_container_number and its seal in lcl_seal_number. Set containers to null.
- Key indicator: if the BL has a "delivery_status" or "shipment_type" field containing "LCL", "LESS THAN CONTAINER LOAD", or similar — always use lcl_container_number, never containers.
- If only one container number appears alongside multiple cargo line items (pallets/cartons) — this is LCL. Use lcl_container_number.
- Only use containers array when each container has its own distinct cargo assignment (FCL pattern).

For cargo_items: extract individual cargo line items for LCL/loose cargo shipments (pallets, cartons, etc.). Set to null if the BL only lists containers (FCL).

The carrier_agent field is the party issuing the BL — may be a carrier, NVOCC, co-loader, or freight forwarder acting as agent.

{
  "waybill_number": "string or null",
  "booking_number": "string or null",
  "carrier_agent": "string or null — the party issuing the BL",
  "vessel_name": "string or null",
  "voyage_number": "string or null",
  "port_of_loading": "string or null",
  "port_of_discharge": "string or null",
  "on_board_date": "string or null — format YYYY-MM-DD if possible",
  "freight_terms": "string or null — PREPAID or COLLECT",
  "shipper_name": "string or null",
  "shipper_address": "string or null",
  "consignee_name": "string or null",
  "consignee_address": "string or null",
  "notify_party_name": "string or null",
  "cargo_description": "string or null",
  "total_weight_kg": "number or null",
  "total_packages": "string or null",
  "delivery_status": "string or null",
  "containers": [
    {
      "container_number": "string or null",
      "container_type": "string or null",
      "seal_number": "string or null",
      "packages": "string or null",
      "weight_kg": "number or null"
    }
  ],
  "cargo_items": [
    {
      "description": "string or null",
      "quantity": "string or null — e.g. 2 PALLET(S)",
      "gross_weight": "string or null — e.g. 2190.00 kg",
      "measurement": "string or null — e.g. 2.1600 M3"
    }
  ],
  "lcl_container_number": "string or null — for LCL/consolidation shipments, the container number of the consolidation box",
  "lcl_seal_number": "string or null — seal number of the LCL consolidation container"
}"""


_CLASSIFY_PROMPT_LOCAL = """You are a freight document classifier. Examine the document and identify the document type.
Reply with ONLY a JSON object (no markdown, no explanation):
{"doc_type": "BL"|"AWB"|"BOOKING_CONFIRMATION"|"UNKNOWN", "confidence": "HIGH"|"MEDIUM"|"LOW"}"""

_BC_EXTRACTION_PROMPT_LOCAL = """You are a freight booking confirmation parser. Extract all available fields from this booking confirmation document.
Reply with ONLY a JSON object (no markdown, no preamble):
{
  "booking_reference": "string or null",
  "carrier": "string or null",
  "vessel_name": "string or null",
  "voyage_number": "string or null",
  "pol_name": "string or null",
  "pol_code": "string or null",
  "pod_name": "string or null",
  "pod_code": "string or null",
  "etd": "YYYY-MM-DD or null",
  "eta_pol": "YYYY-MM-DD or null",
  "eta_pod": "YYYY-MM-DD or null",
  "cut_off_date": "YYYY-MM-DD or null",
  "containers": [{"size": "string", "quantity": "integer"}],
  "cargo_description": "string or null",
  "hs_code": "string or null",
  "cargo_weight_kg": "number or null",
  "booking_party": "string or null",
  "shipper": "string or null"
}"""

_AWB_EXTRACTION_PROMPT_LOCAL = """You are an air waybill parser. Extract all available fields from this Air Waybill (AWB) document.
Determine if this is a House AWB (HAWB) or Master AWB (MAWB) or a direct AWB (MAWB only, no HAWB).
Reply with ONLY a JSON object (no markdown, no preamble):
{
  "awb_type": "HOUSE or MASTER or DIRECT",
  "hawb_number": "string or null",
  "mawb_number": "string or null",
  "shipper_name": "string or null",
  "shipper_address": "string or null",
  "consignee_name": "string or null",
  "consignee_address": "string or null",
  "notify_party": "string or null",
  "origin_iata": "string or null",
  "dest_iata": "string or null",
  "flight_number": "string or null",
  "flight_date": "YYYY-MM-DD or null",
  "pieces": "integer or null",
  "gross_weight_kg": "number or null",
  "chargeable_weight_kg": "number or null",
  "cargo_description": "string or null",
  "hs_code": "string or null"
}"""
