# AcceleFreight — AI Agent Vision
**Created:** 03 March 2026
**Status:** Vision — Target delivery within 2026

---

## Overview

The goal is to evolve AcceleFreight from a system that *records* logistics into one
that *learns* the network over time. AI agents will handle routine discovery,
extraction, and classification tasks autonomously — surfacing proposals to staff
for confirmation rather than making irreversible decisions unilaterally.

---

## Core Philosophy

**Propose, don't decide.**

Agents encounter something new, reason about it, and propose an action. A human
confirms. Over time, as proposals prove reliable, lower-risk actions can become
fully automatic. Higher-risk actions (new company records, financial data) always
retain human confirmation.

```
Encounter unknown → Reason → Propose → Human confirms → Write to system
```

---

## Planned Capabilities

### Phase 1 — Document Intelligence (Partially Built)
Already underway via the `/ai` router in af-server.

| Capability | Status | Notes |
|---|---|---|
| BL document parsing | 🔵 Active | DocumentParseModal + apply flow |
| AWB document parsing | 🔵 Active | apply-awb endpoint working |
| BC document parsing | 🔵 Active | apply-booking-confirmation working |
| Task auto-generation from incoterm | Planned | v2.83+ |

### Phase 2 — Network Discovery
Agents that learn AcceleFreight's operational network from real interactions.

| Capability | Description |
|---|---|
| Location mapping | Encounter unfamiliar address → resolve via Google Maps API → propose as verified location record (tagged `source: agent, status: pending_review`) |
| Supplier discovery | Inbound email from unknown sender → extract signals (domain, signature, context, attachments) → infer supplier relationship → propose draft company record for staff confirmation |

### Phase 3 — Email Intelligence
Monitor operational inbox and extract structured data automatically.

| Capability | Description |
|---|---|
| Supplier email ingestion | Gmail API monitors inbox → agent identifies shipment-related emails → extracts ETD, vessel, reference numbers → proposes updates to matching shipment |
| New contact extraction | Agent identifies new contact details in email thread → proposes addition to company contact records |

### Phase 4 — Autonomous Workflow
Agents that take action based on shipment state changes.

| Capability | Description |
|---|---|
| Incoterm task generation | On shipment creation, agent reads incoterm → generates appropriate task checklist automatically |
| Driver/haulier communication | WhatsApp Business API → agent sends pickup/delivery instructions to assigned driver based on shipment status changes |

---

## Technical Architecture

### Where agents live
All agent endpoints are FastAPI routes under `/ai` in af-server. They ride on the
existing Cloud Run deployment — no separate infrastructure required.

### How agents access knowledge
Two context documents injected at prompt time:
1. **AF-API-Contract.md** — canonical data object definitions (planned v2.83)
2. **AF-Operations-Playbook.md** — business logic, incoterm rules, status semantics (planned post-core)

### How results surface to staff
- **Triggered actions** — user clicks a button, agent runs, result appears in UI (current pattern)
- **Review queue** — new UI component where agent proposals surface for staff to approve/reject
- **Background updates** — agent writes `pending_review` records; staff sees them on next login

### Data tagging
All agent-written records carry metadata:
```
source: "agent"
agent_version: "..."
confidence: 0.0–1.0
status: "pending_review" | "confirmed" | "rejected"
confirmed_by: user_id (when applicable)
```

---

## Sequencing

| Milestone | Description | Target |
|---|---|---|
| Core platform complete | v2.79–v2.82 shipped | Q1 2026 |
| API Contract written | v2.83 — canonical object definitions | Q1 2026 |
| Operations Playbook | Dedicated session with Calvin + Jermaine | Q2 2026 |
| Phase 2 — Network Discovery | Location mapping + supplier discovery | Q2–Q3 2026 |
| Phase 3 — Email Intelligence | Gmail API integration | Q3 2026 |
| Phase 4 — Autonomous Workflow | Task generation + driver comms | Q4 2026 |

---

## Agent Console

A privileged interface for direct agent interaction — separate from the standard
operational UI. This is not a customer-facing or general staff tool.

**Access:** Restricted to the highest permission tier (Admin only — Calvin + designated users)

**Capabilities:**
- Direct instruction to agents (e.g. "scan last 30 days of inbox for unmatched shipments")
- View full agent reasoning and confidence scores, not just the proposal output
- Override or force-confirm pending review items in bulk
- Monitor agent activity log — what ran, when, what it proposed, what was confirmed
- Tune agent behaviour — adjust confidence thresholds, enable/disable specific capabilities

**Where it lives:**
A dedicated section in af-platform under the existing SYSTEM nav group (alongside
Pricing Tables, Geography, System Logs). Gated by Admin role check at route level.

**Why it matters:**
As agents become more autonomous, the console is the control surface. It ensures
there is always a human override path — no agent capability is a black box.

---

## Notes

- The review queue UI is the key new platform component this vision introduces
- The agent console is the key new admin component — Admin role only
- All Phase 2+ capabilities require the API Contract and Operations Playbook to be complete first
- Google Maps API, Gmail API, and WhatsApp Business API are the three external integrations needed
- No model training required — all intelligence is prompt engineering against Claude API
