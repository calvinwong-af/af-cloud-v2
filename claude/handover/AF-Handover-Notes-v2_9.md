# AcceleFreight Project Handover Notes
**Version:** 2.9
**Date:** 26 Feb 2026
**Supersedes:** v2.8 (26 Feb 2026)
**Status:** Active — new chat session reference document

---

## Version History

| Version | Date | Summary |
|---|---|---|
| 1.0 | 25 Feb 2026 | Initial handover. af-web public site completed. af-platform not started. |
| 2.0 | 26 Feb 2026 | V2 data model finalised (spec v0.4). af-platform planned build order confirmed. |
| 2.1 | 26 Feb 2026 | Repo inspected. af-platform actual build state captured — auth, shell, users module verified. |
| 2.2 | 26 Feb 2026 | Data model section expanded in full — Quotation→ShipmentOrder discussion, all structures, V1 mapping, status codes, migration. |
| 2.3 | 26 Feb 2026 | Phase 3–5 built and tested: Companies, Shipments, Dashboard, User Create/Deactivate/Delete. Auth cookie fix. Datastore indexes deployed. Role naming clarified. |
| 2.4 | 26 Feb 2026 | Companies module: Create/Edit/Delete, table redesign (country flag, compact rows, inline ID badge), countid hardening, sort fix, country constants extracted. |
| 2.5 | 26 Feb 2026 | Users module: Edit user (details, role, company assignment, password reset, reactivation). Dropdown clipping fixed (position:fixed pattern). Company name resolved in user table. Company detail page: clickable name link + View Details menu item added. |
| 2.6 | 26 Feb 2026 | Shipment Order module: V2 write path built and tested. New Shipment form (5-step). AF2- ID prefix. Port/company/incoterm searchable comboboxes with keyboard navigation. Date input DD/MMM/YYYY. V1 detail page cargoType bug fixed. |
| 2.7 | 26 Feb 2026 | SEA_LCL and AIR order types added to New Shipment form. Counter bug fixed (AF2- IDs now increment correctly). UI polish: compact order type selector, removed DOMESTIC transaction type, package row layout fixed, incoterm made required. V2 records confirmed invisible to old Vue TMS — expected behaviour. V2 detail page built. Company name resolved on detail load for both V1 and V2. Route card redesigned to port-code-primary display. |
| 2.8 | 26 Feb 2026 | Domain strategy finalised: appv2.accelefreight.com for V2 platform. alfred.accelefreight.com untouched until migration complete. Invoices removed from build scope. Shipment workflow features scoped for future sessions. Deployment config files defined (Dockerfile, .dockerignore, cloudbuild.yaml). |
| 2.9 | 26 Feb 2026 | Cloud Run deployment completed. Dockerfile, .dockerignore, cloudbuild.yaml created and working. af-platform live on Cloud Run. Domain mapping created for appv2.accelefreight.com. SSL certificate provisioning pending (DNS record added to Cloudflare). |

---

## MCP File Access — Important

Claude has **direct MCP filesystem access** to the workspace at `C:\dev\af-cloud-v2` via the filesystem MCP tool. This means:
- Claude can read, create, and edit files directly in the workspace without producing VS Code prompts
- No need to paste prompts into the VS Code Claude plugin for file changes
- Claude should use MCP file access for all code changes going forward

**One known issue:** Files created via the MCP filesystem tool on Windows are saved as **UTF-16** by default. Any file that gcloud or other CLI tools need to read must be re-encoded to UTF-8. Use this PowerShell pattern after creating any new config/YAML files:

```powershell
@'
with open(r'C:\dev\af-cloud-v2\path\to\file', 'r', encoding='utf-8-sig') as f:
    content = f.read()
with open(r'C:\dev\af-cloud-v2\path\to\file', 'w', encoding='utf-8') as f:
    f.write(content)
print("File re-encoded as UTF-8")
'@ | Out-File -FilePath "$env:TEMP\fix_encoding.py" -Encoding UTF8
python "$env:TEMP\fix_encoding.py"
```

TypeScript/TSX files do NOT need re-encoding — Next.js handles them fine.

---

## Working Method

### VS Code Claude Plugin
Still available as fallback, but MCP direct file access is now preferred.

### PowerShell Notes
- No `&&` in PowerShell — run commands separately
- Multi-line commands use backtick `` ` `` for continuation
- gcloud commands with `--verbosity=debug 2>&1 | Out-File "$env:TEMP\gcloud_debug.txt"` for full traceback capture

### Cache Issues
When Next.js throws `Cannot find module './NNN.js'` (stale webpack chunk):
```powershell
rmdir -Recurse -Force .next
npm run build
npm run dev
```

---

## Project Overview

Rebuilding AcceleFreight's digital system from Vue.js → Next.js 14 using the **strangler fig pattern**.

**Two frontends, one backend:**
- `af-web` — Public marketing site → `accelefreight.com` ✅ **LIVE & COMPLETE**
- `af-platform` — Internal TMS → `appv2.accelefreight.com` 🔄 **In progress / deployed to Cloud Run**
- Backend — Python Flask (`af-cloud-webserver`) + Firebase Datastore — **unchanged, do not touch**

---

## Infrastructure

| Domain | Purpose | Status |
|---|---|---|
| `accelefreight.com` / `www.accelefreight.com` | Public site (af-web) | ✅ LIVE |
| `alfred.accelefreight.com` | Old Vue TMS | ⚠️ DO NOT TOUCH — still live for staff |
| `appv2.accelefreight.com` | New TMS (af-platform V2) | 🔄 Deployed — SSL cert pending |

**Firebase Project ID:** `cloud-accele-freight`
**Firebase Account:** calvin.wong@accelefreight.com
**Backend:** Python Flask — never modify

### DNS
- `accelefreight.com` DNS is managed on **Cloudflare** (not GoDaddy — GoDaddy only holds the domain registration)
- Nameservers: `nadia.ns.cloudflare.com` / `theo.ns.cloudflare.com`

### Domain Mapping — Pending Action
A CNAME record must be confirmed in Cloudflare to complete SSL provisioning:
- **Type:** CNAME
- **Name:** `appv2`
- **Target:** `ghs.googlehosted.com.`
- **Proxy status:** DNS only (grey cloud — NOT orange proxied)

Check cert status with:
```powershell
gcloud beta run domain-mappings describe --domain=appv2.accelefreight.com --region=asia-northeast1
```
When `CertificateProvisioned: True` and `Ready: True` — the site is fully live.

### Cloud Run Service
- **Service name:** `af-platform`
- **Region:** `asia-northeast1` (Tokyo — matches Datastore region)
- **Image registry:** `asia-northeast1-docker.pkg.dev/cloud-accele-freight/af-platform/af-platform`
- **Env var set:** `GOOGLE_CLOUD_PROJECT_ID=cloud-accele-freight`

### Redeployment Command
Run from `af-cloud-v2` root:
```powershell
gcloud builds submit --config af-platform/cloudbuild.yaml --substitutions "_FIREBASE_API_KEY=AIzaSyCWE9is9x8J5enCk4Pwx9AAF0gr7wjkNY4,_FIREBASE_AUTH_DOMAIN=cloud-accele-freight.firebaseapp.com,_FIREBASE_PROJECT_ID=cloud-accele-freight,_FIREBASE_STORAGE_BUCKET=cloud-accele-freight.firebasestorage.app,_FIREBASE_MESSAGING_SENDER_ID=667020632236,_FIREBASE_APP_ID=1:667020632236:web:2d9793159856965983ff09"
```

### Environment Variables (af-platform/.env.local)
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCWE9is9x8J5enCk4Pwx9AAF0gr7wjkNY4
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cloud-accele-freight.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cloud-accele-freight
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=cloud-accele-freight.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=667020632236
NEXT_PUBLIC_FIREBASE_APP_ID=1:667020632236:web:2d9793159856965983ff09
GOOGLE_CLOUD_PROJECT_ID=cloud-accele-freight
```

### Datastore Indexes
Composite indexes defined in `af-cloud-v2/index.yaml`. All confirmed ✅ Ready:
- `Quotation` — `trash` + `updated DESC`
- `Quotation` — `trash` + `company_id` + `updated DESC`
- `Company` — `trash` + `name`
- `Company` — `trash` + `countid DESC`

---

## Module 1: af-web — ✅ COMPLETE

Next.js 14.2.x static export, Tailwind (design tokens only), Google Fonts (Syne / Outfit / JetBrains Mono). All 5 pages live: `/`, `/about`, `/services`, `/faq`, `/contact`.

---

## Module 2: af-platform — 🔄 In Progress

### Tech Stack
- Next.js 14.2.35, React 18, TypeScript — SSR mode (`output: "standalone"`)
- Tailwind CSS 3.4 (full compiler)
- Firebase Auth (`firebase` v12, client-side)
- `firebase-admin` v13 (server-side)
- `@google-cloud/datastore` v10 (server-side only via Server Actions)
- `lucide-react`, `clsx`, `tailwind-merge`

### Design Tokens (globals.css)
```css
--slate: #0f1c2e       --slate-mid: #1a2f47    --slate-light: #243b55
--sky: #3b9eff         --sky-light: #6cb8ff    --sky-pale: #e8f4ff    --sky-mist: #f0f7ff
--surface: #f0f4f8     --border: #dde5ef
--text: #0f1c2e        --text-mid: #3d5473     --text-muted: #7a93b0
```

### Sidebar Nav — Current Status
| Route | Status |
|---|---|
| `/dashboard` | ✅ Built — live KPI data |
| `/quotations` | ❌ Not built |
| `/shipments` | ✅ Built — list + detail (V1 + V2) + V2 create (SEA_FCL, SEA_LCL, AIR) |
| `/invoices` | ❌ Removed from scope |
| `/users` | ✅ Built — full CRUD |
| `/companies` | ✅ Built — full CRUD + detail page |
| `/pricing` | ❌ Not built |
| `/geography` | ❌ Not built |
| `/logs` | ❌ Not built |

### File Structure — What's Built
```
src/
├── lib/
│   ├── firebase.ts
│   ├── firebase-admin.ts
│   ├── auth.ts
│   ├── auth-server.ts
│   ├── datastore.ts
│   ├── datastore-query.ts
│   ├── users.ts
│   ├── companies.ts
│   ├── companies-write.ts
│   ├── company-constants.ts
│   ├── shipments.ts
│   ├── shipments-write.ts
│   ├── v1-assembly.ts
│   ├── types.ts
│   └── utils.ts
│
├── app/
│   ├── actions/
│   │   ├── users.ts
│   │   ├── companies.ts
│   │   ├── shipments.ts
│   │   └── shipments-write.ts
│   │
│   └── (platform)/
│       ├── dashboard/page.tsx
│       ├── companies/
│       │   ├── page.tsx
│       │   └── [id]/page.tsx
│       ├── shipments/
│       │   ├── page.tsx
│       │   └── [id]/page.tsx
│       └── users/page.tsx
│
└── components/
    ├── shared/KpiCard.tsx
    ├── companies/
    │   ├── CompanyTable.tsx
    │   ├── CompanyActionsMenu.tsx
    │   ├── CreateCompanyModal.tsx
    │   └── EditCompanyModal.tsx
    ├── shipments/
    │   ├── ShipmentOrderTable.tsx
    │   ├── CreateShipmentModal.tsx
    │   └── NewShipmentButton.tsx
    └── users/
        ├── UserTable.tsx
        ├── CreateUserModal.tsx
        ├── EditUserModal.tsx
        └── UserActionsMenu.tsx
```

---

## Known Issues / TODOs

### Data
- `CompanyUserAccount` — 54% missing `company_id`. Guarded with `?? null`.
- `PortShipmentTasks` — `tax_charge`/`duty_charge` mixed types. Always `parseFloat()`.
- New companies/shipments created in af-platform are **not visible in old Vue TMS** — expected, resolves when Vue TMS is retired.

### Features Not Yet Built
- Shipment workflow features — see section below
- Shipment detail improvements — workflow timeline, files tab, parties cards (V1 records)
- Company detail page — file management tab
- Pricing Tables module
- Geography module
- System Logs module
- Quotations module

### Post-Migration (do not do yet)
- Rename `AFU`/`AFC` roles to `INTERNAL`/`CUSTOMER`
- Repair 54% broken `CompanyUserAccount` links
- Normalise `PortShipmentTasks` mixed types
- Rename `AF2-` prefix → `AF-` (after migration finalised)
- Rename Datastore Kind `Quotation` → `ShipmentOrder`
- Re-evaluate `DOMESTIC` transaction type for ground transport
- Retire `appv2.accelefreight.com`, point `alfred.accelefreight.com` to Cloud Run

---

## Recommended Build Order (Next Sessions)

| Priority | Item | Notes |
|---|---|---|
| ✅ | ~~Cloud Run deployment~~ | Done — af-platform live, domain mapping pending SSL |
| 🔴 1 | **Confirm appv2.accelefreight.com is live** | Verify Cloudflare CNAME + SSL cert active |
| 🟡 2 | **Shipment status management** | Manual status advancement on detail page. UI + write action. |
| 🟡 3 | **Incoterm task definitions** | Rules engine: given incoterm + transaction type, define who owns which legs |
| 🟡 4 | **Tasks applied to routing** | Customs clearance, ground pickup/delivery tasks attached to shipment route nodes |
| 🟠 5 | **Pricing Tables** | Server-side only, AFU-ADMIN access only |
| ⚪ 6 | **Geography, System Logs** | Lower priority reference modules |
| ⚪ 7 | **Quotations module** | Commercial quotation creation, PDF generation |

---

## Shipment Workflow Features — Scoped for Next Sessions

These three features form the foundation of a **Shipment Workflow Engine** and should be designed together before any code is written.

### 1. Shipment Status Management
Allow staff to manually advance a shipment through its lifecycle status codes from the detail page. Each status transition may require confirmation. Some transitions are restricted.

Current status codes:
`1001 Draft → 1002 Pending Review → 2001 Confirmed → 2002 Booking Pending → 3001 Booked → 3002 In Transit → 3003 Arrived → 4001 Clearance In Progress → 4002 Exception → 5001 Completed / -1 Cancelled`

### 2. Incoterm Task Definitions
Each incoterm defines the boundary of responsibility between seller and buyer. Combined with `transaction_type` (IMPORT/EXPORT), this determines which party is responsible for each leg.

Goal: auto-generate a task checklist when a shipment is created, based on incoterm + transaction type.

### 3. Tasks Applied to Routing
Operational tasks attached to specific nodes in the shipment route. Each task has: type, responsible party, status, assignee, due date, notes.

Task types: export customs clearance, origin haulage/pickup, ocean/air freight booking, import customs clearance, destination delivery/haulage.

V2 will generalise into a full `workflow_tasks` array on the `ShipmentWorkFlow` Kind.

---

## Data Model — The Quotation → ShipmentOrder Transition

### The Decision: ShipmentOrder-First Architecture
V2 makes the **ShipmentOrder the primary object**. A commercial quotation is optional and attached when needed.

**Key principle:** A shipment can exist without a quotation. A quotation cannot exist without a shipment.

### V2 ShipmentOrder Record (Datastore Kind: `Quotation`, prefix `AF2-`)
Written by `shipments-write.ts`. Full spec in `AF-V2-Data-Model-v0_4.md`.

### V1 Records (Datastore Kind: `Quotation`, prefix `AFCQ-`)
Read via `v1-assembly.ts`. Read-only in V2. Never write to V1 records.

### Status Codes
| Code | Label |
|---|---|
| 1001 | Draft |
| 1002 | Pending Review |
| 2001 | Confirmed |
| 2002 | Booking Pending |
| 3001 | Booked |
| 3002 | In Transit |
| 3003 | Arrived |
| 4001 | Clearance In Progress |
| 4002 | Exception |
| 5001 | Completed |
| -1 | Cancelled |
