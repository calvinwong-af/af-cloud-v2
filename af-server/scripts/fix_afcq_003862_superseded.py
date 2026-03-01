"""
One-time fix: set superseded=True on ShipmentOrder AFCQ-003862
so it no longer appears in the list alongside its migrated AF-003862 counterpart.
Run with: python -m scripts.fix_afcq_003862_superseded
"""
from core.datastore import get_client


def main():
    client = get_client()
    key = client.key("ShipmentOrder", "AFCQ-003862")
    entity = client.get(key)
    if not entity:
        print("AFCQ-003862 ShipmentOrder not found")
        return
    if entity.get("superseded"):
        print("Already superseded — nothing to do")
        return
    entity["superseded"] = True
    client.put(entity)
    print("Done — AFCQ-003862 marked as superseded")


if __name__ == "__main__":
    main()
