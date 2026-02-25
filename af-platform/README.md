# af-platform

AcceleFreight Internal TMS — alfred.accelefreight.com

**Status: Planned — build begins after af-web is live.**

## Scope
- Auth flow (Firebase Auth, role detection: AFC / AFU / Admin)
- Quotation module (5-step wizard)
- Shipment tracking
- Pricing table management
- Invoicing + Xero integration

## Notes
- Connects to the same `af-cloud-webserver` Python backend
- Replaces the existing Vue SPA on alfred.accelefreight.com
- Existing Firebase Datastore data is preserved — no migration