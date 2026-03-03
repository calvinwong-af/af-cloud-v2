"""
routers/ai.py

AI-powered document parsing endpoints.
POST /api/v2/ai/parse-document — classify and extract structured data from freight PDFs.
"""

import json
import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import Claims, require_auth

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ParseDocumentRequest(BaseModel):
    file_base64: str
    file_name: str
    hint: str | None = None  # "BL" | "AWB" | "BOOKING_CONFIRMATION"


# ---------------------------------------------------------------------------
# Claude prompts
# ---------------------------------------------------------------------------

_CLASSIFY_PROMPT = """You are a freight document classifier. Examine the PDF and identify the document type.
Reply with ONLY a JSON object (no markdown, no explanation):
{"doc_type": "BL"|"AWB"|"BOOKING_CONFIRMATION"|"UNKNOWN", "confidence": "HIGH"|"MEDIUM"|"LOW"}"""

_BL_EXTRACTION_PROMPT = """You are extracting structured data from a Bill of Lading or Sea Waybill.
Return ONLY valid JSON, no preamble, no markdown, no code fences.
Use null for any field not present.

For containers: extract container details if present (FCL shipments). Set to null if no container numbers are found (LCL/loose cargo).
For cargo_items: extract individual cargo line items for LCL/loose cargo shipments (pallets, cartons, etc.). Set to null if the BL only lists containers.

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
  ]
}"""

_BC_EXTRACTION_PROMPT = """You are a freight booking confirmation parser. Extract all available fields from this booking confirmation PDF.
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

_AWB_EXTRACTION_PROMPT = """You are an air waybill parser. Extract all available fields from this Air Waybill (AWB) PDF.
Determine if this is a House AWB (HAWB) or Master AWB (MAWB) or a direct AWB (MAWB only, no HAWB).
A direct AWB is when the document is a MAWB with no associated HAWB reference.
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

_EXTRACTION_PROMPTS = {
    "BL": _BL_EXTRACTION_PROMPT,
    "AWB": _AWB_EXTRACTION_PROMPT,
    "BOOKING_CONFIRMATION": _BC_EXTRACTION_PROMPT,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences from Claude response."""
    text = text.strip()
    if text.startswith("```"):
        first_nl = text.find("\n")
        if first_nl != -1:
            text = text[first_nl + 1:]
        if text.endswith("```"):
            text = text[:-3]
    return text.strip()


async def _call_claude_async(api_key: str, file_base64: str, prompt: str) -> str:
    """Send a PDF to Claude asynchronously and return the text response."""
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        timeout=30.0,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": file_base64,
                    },
                },
                {"type": "text", "text": prompt},
            ],
        }],
    )
    return response.content[0].text


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/parse-document")
async def parse_document(
    req: ParseDocumentRequest,
    claims: Claims = Depends(require_auth),
):
    import anthropic as _anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    # --- Step 1: Classify ---
    doc_type = req.hint  # use hint if provided
    confidence = "HIGH" if req.hint else None

    if not doc_type:
        try:
            raw = await _call_claude_async(api_key, req.file_base64, _CLASSIFY_PROMPT)
            classify_json = json.loads(_strip_code_fences(raw))
            doc_type = classify_json.get("doc_type", "UNKNOWN")
            confidence = classify_json.get("confidence", "LOW")
            logger.info("[parse-document] Classified as %s (%s)", doc_type, confidence)
        except json.JSONDecodeError:
            logger.warning("[parse-document] Classification JSON parse failed: %s", raw[:200])
            return {"status": "ERROR", "msg": "Claude classification response was not valid JSON", "raw": raw[:500]}
        except _anthropic.APITimeoutError:
            logger.error("[parse-document] Claude API timeout after 30s (classification)")
            raise HTTPException(status_code=503, detail="Document parsing timed out — please try again")
        except Exception as e:
            logger.error("[parse-document] Classification failed: %s", e)
            raise HTTPException(status_code=500, detail=f"Document classification failed: {e}")

    if doc_type == "UNKNOWN" or doc_type not in _EXTRACTION_PROMPTS:
        return {"status": "OK", "doc_type": "UNKNOWN", "confidence": confidence or "LOW", "data": {}}

    # --- Step 2: Extract ---
    extraction_prompt = _EXTRACTION_PROMPTS[doc_type]

    try:
        raw = await _call_claude_async(api_key, req.file_base64, extraction_prompt)
        data = json.loads(_strip_code_fences(raw))
        logger.info("[parse-document] Extracted %d fields for %s", len(data), doc_type)
    except json.JSONDecodeError:
        logger.warning("[parse-document] Extraction JSON parse failed: %s", raw[:200])
        return {"status": "ERROR", "msg": "Claude response was not valid JSON", "raw": raw[:500]}
    except _anthropic.APITimeoutError:
        logger.error("[parse-document] Claude API timeout after 30s")
        raise HTTPException(status_code=503, detail="Document parsing timed out — please try again")
    except Exception as e:
        logger.error("[parse-document] Extraction failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Document extraction failed: {e}")

    return {
        "status": "OK",
        "doc_type": doc_type,
        "confidence": confidence,
        "data": data,
    }
