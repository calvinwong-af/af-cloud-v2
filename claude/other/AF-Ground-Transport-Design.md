# AcceleFreight — Ground Transport Design
**Version:** 1.1
**Date:** 11 March 2026
**Status:** Approved — pending implementation
**Author:** Session 93 design discussion (Calvin + Claude)

---

## 1. Overview

Ground transport covers all land-based movement of cargo managed by AcceleFreight. This document defines the operational model, transport type taxonomy, relationship architecture, and schema design that will guide implementation.

This design supersedes the ad-hoc approach in the initial ground transport build (migration 008 / unified orders migration 011) and establishes the canonical architecture for all future ground transport work.

---

## 2. Transport Type Taxonomy

Four transport types are supported under a single unified order model, differentiated by a `transport_type` discriminator:

| `transport_type` | Description | Shipment Link | Pricing |
|---|---|---|---|
| `haulage` | FCL container pickup/delivery at port | Parent-child via task | Port transport rate cards (per container, zone-based) |
| `port` | LCL consolidation runs to/from port | Parent-child via task | Port transport rate cards (per trip, zone-based) |
| `general` | Standalone domestic point-to-point trucking | None (free-text ref only) | TBD |
| `cross_border` | International moves (MY-SG, MY-TH, etc.) | TBD (deferred) | TBD |

### 2.1 Haulage vs Port

The distinction mirrors the FCL/LCL split in sea freight:

- **Haulage** is for FCL — multiple containers possible, detention tracking, priced per container
- **Port** is for LCL — consolidated cargo, priced per trip, no detention tracking needed

Both are operationally linked to a freight shipment via workflow task. Both use the same `port_transport_rate_cards` / `port_transport_rates` pricing tables — the `transport_type` field determines which lookup path applies.

### 2.2 General Transport

General transport has no formal shipment parent. A free-text `notes` field may be used to reference a related shipment or job if needed. No hard FK relationship.

### 2.3 Cross-Border (Deferred)

Cross-border transport (MY-SG, MY-TH) will be a future `transport_type` value. It will eventually cover both export and import customs clearance as part of the same order. Schema is designed to accommodate this without changes — adding a new discriminator value is sufficient.

---

## 3. Relationship Architecture

### 3.1 The Chain

```
orders (order_type = 'shipment')
  └── shipment_workflow_tasks
        └── orders (order_type = 'transport', transport_type = 'haulage' | 'port')
              └── order_legs (individual truck trips within the order)
```

Transport orders link to their freight shipment **through the workflow task**, not directly. This is the canonical relationship for haulage and port transport.

The transport order holds a `task_id` FK pointing to the `shipment_workflow_tasks` row. Shipment context is always derived by traversing `task -> shipment`.

### 3.2 Why Task-Mediated (not direct shipment FK)

| Concern | Rationale |
|---|---|
| Direction is implicit | Task type determines pickup vs delivery — no extra field needed on the transport order |
| Lifecycle coupling | If a task mode changes to `IGNORED`, the linked transport order is automatically cancelled |
| Single source of truth | No risk of a transport order pointing to a different shipment than its task |
| Simpler shipment model | Shipment does not manage child orders directly — transport order discoverable via task |
| Conflict prevention | Misaligned relationships become structurally impossible |

### 3.3 Task to Transport Order Cardinality

The relationship is strictly **one task to one transport order**.

A single transport order handles all the operational complexity internally — multiple containers, multiple truck trips, and detention moves are all represented as **legs within the order**, not as separate orders.

**Example — 5-container haulage:**
- 1 shipment, 5 containers
- 1 `ORIGIN_HAULAGE` task
- 1 haulage transport order
- 5 legs (or 10 legs if detention applies to each container)

The order is the job. The legs are the individual truck runs within that job.

Discovering the transport order for a task:
```sql
SELECT * FROM orders WHERE task_id = :task_id AND order_type = 'transport';
```

### 3.4 Direction Derivation

The transport order operational direction (pickup vs delivery) is fully determined by the parent task type:

| Task Type | Direction |
|---|---|
| `ORIGIN_HAULAGE` | Pickup — cargo moves toward port |
| `DESTINATION_HAULAGE` | Delivery — cargo moves from port to consignee |

No explicit `direction` field is needed on the transport order.

### 3.5 General Transport (No Task Link)

General transport orders have `task_id = NULL`. They are standalone orders with no shipment context. A free-text reference may be added via the `notes` field.

### 3.6 Removal of `parent_order_id`

The current `orders.parent_order_id` column will be **dropped entirely** in the migration. Its purpose is fully superseded by `task_id` for haulage/port orders, and it has no role for general transport. Retaining it creates confusion as the system grows.

The migration must handle existing data: where `parent_order_id` points to a shipment, the corresponding `task_id` should be backfilled from `shipment_workflow_tasks` where a matching task can be identified. Records where the link cannot be resolved will have `task_id = NULL` after migration (acceptable trade-off).

---

## 4. Schema Changes Required

### 4.1 `orders` table — add `task_id`, drop `parent_order_id`

```sql
-- Add task_id FK
ALTER TABLE orders
    ADD COLUMN task_id INTEGER NULL REFERENCES shipment_workflow_tasks(task_id);

CREATE UNIQUE INDEX idx_orders_task_id ON orders(task_id)
    WHERE task_id IS NOT NULL AND order_type = 'transport';

-- Backfill task_id from existing parent_order_id where resolvable
-- (script to be written as part of migration — unresolvable records left as NULL)

-- Drop parent_order_id
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_parent;
ALTER TABLE orders DROP COLUMN parent_order_id;
DROP INDEX IF EXISTS idx_orders_parent_order_id;
```

Two things to note:
- `task_id` is nullable — null for general transport and cross-border (future)
- The unique index is partial (scoped to `order_type = 'transport'`) — enforces the one-task-one-order constraint at the DB level

### 4.2 `orders.transport_mode` -> `orders.transport_type`

The existing `transport_mode` column uses values `haulage` and `trucking`. This will be migrated to `transport_type` with the new taxonomy:

| Old `transport_mode` | New `transport_type` |
|---|---|
| `haulage` | `haulage` |
| `trucking` | `general` |
| _(new)_ | `port` |
| _(future)_ | `cross_border` |

> **WARNING:** Breaking change on both column name and the `trucking` value. All router code, frontend actions, and TypeScript types must be updated in the same implementation prompt.

### 4.3 `shipment_workflow_tasks` — no changes needed

The task table does not need a new column. The relationship is owned by the transport order (`orders.task_id`), not the task. Discovering the transport order for a task is done by querying `orders WHERE task_id = :task_id`.

---

## 5. Lifecycle Rules

### 5.1 Task Scope -> Transport Order Lifecycle

| Task `mode` change | Effect on linked transport order |
|---|---|
| `ASSIGNED` -> `IGNORED` | Transport order auto-cancelled |
| `IGNORED` -> `ASSIGNED` | Order remains cancelled (manual re-create required) |
| `ASSIGNED` -> `TRACKED` | No effect (third-party handles — order retained for reference) |

### 5.2 Transport Order Status

No changes to existing status progression:
`draft -> confirmed -> dispatched -> in_transit -> detained (haulage only) -> completed | cancelled`

---

## 6. UI Design — Shipment Integration

### 6.1 Current State

Transport orders exist as a separate module (`/ground-transport/[id]`), completely disconnected from the shipment detail page. There is no UI to create, view, or manage transport orders from within a shipment.

### 6.2 Target State

Transport order management is embedded directly in the shipment workflow task cards:

- `ORIGIN_HAULAGE` task card — shows an **Arrange Transport** action button when mode is `ASSIGNED` and no transport order exists yet
- `DESTINATION_HAULAGE` task card — same pattern
- Clicking **Arrange Transport** opens a creation modal pre-filled with shipment context (port, container numbers for haulage, cargo weight/CBM for port, incoterm-derived direction)
- Once a transport order exists, the task card shows an inline summary — order status, vehicle, stop addresses, number of legs
- Clicking the summary navigates to the full transport order detail page

### 6.3 New UI Components Required

| Component | Location | Purpose |
|---|---|---|
| `TransportOrderSummary` | Shipment task card (inline) | Shows linked transport order status at a glance |
| `CreateTransportOrderModal` | Shipment task card | Create haulage/port transport order from shipment context |
| Transport action button | Task card header | Entry point to create/view transport order |

### 6.4 Out of Scope for Initial Implementation

- General transport creation from shipment context (no task link — separate flow)
- Cross-border transport
- Pricing lookup / rate suggestion at order creation time (future)
- Customer-facing transport visibility

---

## 7. Pricing Integration (Future)

Port transport pricing is already fully built (`port_transport_rate_cards`, `port_transport_rates`). The integration point — looking up the applicable rate card at transport order creation time — is deferred but the design supports it:

At order creation, given `port_un_code` + `area_id` + `vehicle_type_id`, query `port_transport_rate_cards` for the matching card and return the current `list_price` as a suggested rate. This will be part of the Quotation workstream, not this transport integration workstream.

---

## 8. Out of Scope

| Item | Notes |
|---|---|
| Cross-border transport | Deferred — new `transport_type` value only, no implementation |
| General transport pricing | Not designed yet |
| Customer-facing transport UI | AFC users cannot see transport orders in V1 of this design |
| Driver communications (WhatsApp) | AI agent phase — deferred |
| Port transport for AIR shipments | Not applicable |

---

## 9. Resolved Design Decisions

| # | Question | Resolution |
|---|---|---|
| OQ-01 | Can one task have multiple linked transport orders? | **No — one task, one transport order.** The order handles multiplicity internally via legs. 5 containers = 1 order with 5 legs (10 with detention). |
| OQ-02 | For LCL port transport — one order per shipment or can one order cover multiple LCL shipments? | **One transport order per shipment.** A driver may consolidate multiple shipments operationally but each shipment manages its own transport order independently. |
| OQ-03 | `parent_order_id` retention strategy | **Remove entirely.** Creates confusion as system grows. Purpose fully superseded by `task_id`. Dropped from `orders` table in migration, not just deprecated. |

---

## 10. Implementation Sequence (Proposed)

1. **Schema migration** — add `task_id` to `orders` (with unique partial index), drop `parent_order_id`, rename `transport_mode` -> `transport_type`, backfill script for existing records
2. **Backend** — update ground transport router: `transport_type` discriminator, `task_id` FK, task scope lifecycle rule, GET endpoint to fetch transport order by `task_id`
3. **Frontend actions** — update TypeScript types and server actions for renamed fields and new `transport_type` values
4. **Shipment task card UI** — `TransportOrderSummary`, `CreateTransportOrderModal`, action button wired to `ORIGIN_HAULAGE` / `DESTINATION_HAULAGE` tasks
5. **API Contract update** — document new fields, lifecycle rules, task-mediated relationship, removal of `parent_order_id`

---

*All open questions resolved. Document ready for implementation scoping.*
