"""
core/constants.py

Platform-wide constants — ported and cleaned from V1 constants.py.

Dropped:
  - Redis keys (no Redis in V2)
  - GAE task queue URIs
  - dash.accelefreight.com references
  - TEST_ACCOUNTS / TEST_COMPANIES (use env-based feature flags instead)
  - BigQuery / PubSub topic strings (not in V2 Phase 1)
"""

# ---------------------------------------------------------------------------
# GCP Project
# ---------------------------------------------------------------------------
PROJECT_ID = "cloud-accele-freight"
PROJECT_LOCATION = "asia-northeast1"

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------
FILES_BUCKET_NAME = "files-accelefreight"

# ---------------------------------------------------------------------------
# Account types
# ---------------------------------------------------------------------------
AFU = "AFU"   # AcceleFreight internal user
AFC = "AFC"   # Client company user

# ---------------------------------------------------------------------------
# Roles
# ---------------------------------------------------------------------------
AFU_ADMIN = "AFU-ADMIN"   # Full admin
AFU_SM    = "AFU-SM"      # Sales Manager
AFU_SE    = "AFU-SE"      # Sales Executive
AFC_ADMIN = "AFC-ADMIN"   # Company Admin
AFC_M     = "AFC-M"       # Company Manager (V2 addition)

# ---------------------------------------------------------------------------
# Access control groups  (used in auth.py guards)
# ---------------------------------------------------------------------------
ALL_ROLES       = [AFU_ADMIN, AFU_SM, AFU_SE, AFC_ADMIN, AFC_M]
AFU_ROLES       = [AFU_ADMIN, AFU_SM, AFU_SE]
AFC_ROLES       = [AFC_ADMIN, AFC_M]
SALES_ROLES     = [AFU_ADMIN, AFU_SM]
SALES_EXEC_ROLES= [AFU_ADMIN, AFU_SM, AFU_SE]
ADMIN_ONLY      = [AFU_ADMIN]

SUPER_ADMIN_ACCESS = ["calvin.wong@accelefreight.com", "isaac@accelefreight.com"]

# ---------------------------------------------------------------------------
# Order / Shipment types  (V2 order_type field)
# ---------------------------------------------------------------------------
ORDER_TYPE_SEA_FCL      = "SEA_FCL"
ORDER_TYPE_SEA_LCL      = "SEA_LCL"
ORDER_TYPE_AIR          = "AIR"
ORDER_TYPE_CROSS_BORDER = "CROSS_BORDER"
ORDER_TYPE_GROUND       = "GROUND"

ALL_ORDER_TYPES = [
    ORDER_TYPE_SEA_FCL,
    ORDER_TYPE_SEA_LCL,
    ORDER_TYPE_AIR,
    ORDER_TYPE_CROSS_BORDER,
    ORDER_TYPE_GROUND,
]

# V1 quotation_type values — used when reading V1 records
V1_TYPE_FCL = "FCL"
V1_TYPE_LCL = "LCL"
V1_TYPE_AIR = "AIR"

# ---------------------------------------------------------------------------
# Transaction types
# ---------------------------------------------------------------------------
IMPORT = "IMPORT"
EXPORT = "EXPORT"

# ---------------------------------------------------------------------------
# V2 ShipmentOrder status codes
# (Quotation Kind, prefix AF2-)
# ---------------------------------------------------------------------------
STATUS_DRAFT              = 1001
STATUS_DRAFT_REVIEW       = 1002
STATUS_CONFIRMED          = 2001
STATUS_BOOKING_PENDING    = 2002
STATUS_BOOKED             = 3001
STATUS_IN_TRANSIT         = 3002
STATUS_ARRIVED            = 3003
STATUS_CLEARANCE          = 4001
STATUS_EXCEPTION          = 4002
STATUS_COMPLETED          = 5001
STATUS_CANCELLED          = -1

V2_ACTIVE_STATUSES = [
    STATUS_CONFIRMED,
    STATUS_BOOKING_PENDING,
    STATUS_BOOKED,
    STATUS_IN_TRANSIT,
    STATUS_ARRIVED,
    STATUS_CLEARANCE,
    STATUS_EXCEPTION,
]

STATUS_LABELS = {
    STATUS_DRAFT:           "Draft",
    STATUS_DRAFT_REVIEW:    "Pending Review",
    STATUS_CONFIRMED:       "Confirmed",
    STATUS_BOOKING_PENDING: "Booking Pending",
    STATUS_BOOKED:          "Booked",
    STATUS_IN_TRANSIT:      "In Transit",
    STATUS_ARRIVED:         "Arrived",
    STATUS_CLEARANCE:       "Clearance In Progress",
    STATUS_EXCEPTION:       "Exception",
    STATUS_COMPLETED:       "Completed",
    STATUS_CANCELLED:       "Cancelled",
}

# ---------------------------------------------------------------------------
# V1 ShipmentOrder status codes
# (ShipmentOrder Kind, prefix AFCQ- shipment_order_id)
# Used only when reading / mapping V1 records — never written by V2
# ---------------------------------------------------------------------------
V1_STATUS_CREATED            = 1
V1_STATUS_BOOKING_STARTED    = 100
V1_STATUS_BOOKING_CONFIRMED  = 110    # equivalent to V2 STATUS_BOOKED (3001)
V1_STATUS_IN_TRANSIT         = 4110   # equivalent to V2 STATUS_IN_TRANSIT (3002)
V1_STATUS_COMPLETED          = 10000  # equivalent to V2 STATUS_COMPLETED (5001)

# Mapping V1 ShipmentOrder.status → V2 status code
V1_TO_V2_STATUS = {
    V1_STATUS_CREATED:           STATUS_CONFIRMED,
    V1_STATUS_BOOKING_STARTED:   STATUS_BOOKING_PENDING,
    V1_STATUS_BOOKING_CONFIRMED: STATUS_BOOKED,
    V1_STATUS_IN_TRANSIT:        STATUS_IN_TRANSIT,
    V1_STATUS_COMPLETED:         STATUS_COMPLETED,
}

# V1 records are "active" when status >= 110 and < 10000
V1_ACTIVE_MIN = V1_STATUS_BOOKING_CONFIRMED
V1_ACTIVE_MAX = V1_STATUS_COMPLETED

# ---------------------------------------------------------------------------
# V1 Quotation status codes
# (Quotation Kind, prefix AFCQ-)
# Used only for reading V1 records
# ---------------------------------------------------------------------------
V1_Q_EXPIRED   = -1
V1_Q_DRAFT     = 1001
V1_Q_REQUEST   = 1002
V1_Q_PROPOSED  = 2001
V1_Q_CONFIRMED = 3001
V1_Q_ACTIVE    = 4001
V1_Q_COMPLETED = 5001

# ---------------------------------------------------------------------------
# CommercialQuotation status  (V2 only)
# ---------------------------------------------------------------------------
CQ_DRAFT   = "DRAFT"
CQ_SENT    = "SENT"
CQ_ACCEPTED= "ACCEPTED"
CQ_REVISED = "REVISED"
CQ_EXPIRED = "EXPIRED"

# ---------------------------------------------------------------------------
# Incoterms
# ---------------------------------------------------------------------------
INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP", "DAT", "CNF"]

# Ported from V1: defines which workflow process levels apply per incoterm + transaction
# Level map: 1=cargo_to_port, 2=export_clearance, 3=vessel_departure,
#            4=vessel_in_transit, 5=vessel_arrival, 6=import_clearance, 7=delivery
INCOTERM_LEVELS = {
    "EXW": {"EXPORT": (1, 5), "IMPORT": (1, 7)},
    "FOB": {"EXPORT": (1, 5), "IMPORT": (1, 7)},
    "CNF": {"EXPORT": (1, 5), "IMPORT": (3, 7)},
    "CFR": {"EXPORT": (1, 5), "IMPORT": (3, 7)},
    "CIF": {"EXPORT": (1, 5), "IMPORT": (3, 7)},
    "DAT": {"EXPORT": (1, 5), "IMPORT": (3, 7)},
    "DPU": {"EXPORT": (1, 5), "IMPORT": (3, 7)},
    "DAP": {"EXPORT": (1, 7), "IMPORT": (3, 7)},
    "DDP": {"EXPORT": (1, 7), "IMPORT": (3, 7)},
    "FCA": {"EXPORT": (1, 5), "IMPORT": (1, 7)},
    "CPT": {"EXPORT": (1, 5), "IMPORT": (3, 7)},
    "CIP": {"EXPORT": (1, 5), "IMPORT": (3, 7)},
}

# ---------------------------------------------------------------------------
# Cargo
# ---------------------------------------------------------------------------
DANGEROUS_GOODS = "DG"

# Unit types
UNIT_SET       = "SET"
UNIT_CONTAINER = "CTR"
REVENUE_TONNE  = "RT"
CBM_3KG        = "C3KG"   # 1 cbm : 300 kg
KG             = "KG"

AIR_CUBIC_CONVERSION_FACTOR = 167   # kg per cbm for air chargeable weight

# ---------------------------------------------------------------------------
# ID prefixes
# ---------------------------------------------------------------------------
PREFIX_V2_SHIPMENT = "AF2-"
PREFIX_V1_SHIPMENT = "AFCQ-"
PREFIX_COMPANY     = "AFC-"
