"""Quick inspection of AFCQ-003837 in Datastore."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv; load_dotenv(".env.local")
from core.datastore import get_client

ds = get_client()
key = ds.key("ShipmentOrder", "AFCQ-003837")
e = ds.get(key)
if not e:
    print("Not found")
else:
    print("origin:", e.get("origin"))
    print("destination:", e.get("destination"))
