# PROMPT-CURRENT — BL-28: Container schema merge on BL update

## Problem
Two different container object schemas exist in type_details.containers:

Creation schema (written by create_shipment_manual):
  { "container_size": "20GP", "container_type": "DRY", "quantity": 1, "container_numbers": [], "seal_numbers": [] }

BL-parsed schema (written by PATCH /bl endpoint):
  { "container_number": "SEGU6868838", "container_type": "40HQ", "seal_number": "YMAV438141" }

After a BL update, type_details.containers is REPLACED with BL-parsed objects.
TypeDetailsCard reads c.container_size and c.quantity which are absent — renders blank size badge and no quantity.

## Fix — Two parts

---

### PART 1 — Backend: merge BL containers into existing type_details

File: af-server/routers/shipments.py
Location: inside update_from_bl(), the containers block

Current code:
```python
if containers is not None:
    try:
        containers_list = json.loads(containers)
    except (ValueError, TypeError):
        containers_list = None
    if containers_list:
        type_details["containers"] = containers_list
```

Replace with:
```python
if containers is not None:
    try:
        containers_list = json.loads(containers)
    except (ValueError, TypeError):
        containers_list = None
    if containers_list:
        existing = type_details.get("containers") or []
        merged = []
        for i, bl_c in enumerate(containers_list):
            existing_row = existing[i] if i < len(existing) else {}
            merged_row = dict(existing_row)
            if bl_c.get("container_number"):
                merged_row["container_number"] = bl_c["container_number"]
            if bl_c.get("seal_number"):
                merged_row["seal_number"] = bl_c["seal_number"]
            if bl_c.get("container_type"):
                merged_row["container_type"] = bl_c["container_type"]
            merged.append(merged_row)
        for bl_c in containers_list[len(existing):]:
            merged.append({
                "container_number": bl_c.get("container_number"),
                "container_type": bl_c.get("container_type"),
                "seal_number": bl_c.get("seal_number"),
                "container_size": None,
                "quantity": 1,
            })
        type_details["containers"] = merged
```

---

### PART 2 — Frontend: render both schemas in TypeDetailsCard

File: af-platform/src/app/(platform)/shipments/[id]/page.tsx

Step 1 — extend ContainerDetail in lib/types.ts, add two optional fields:
```typescript
export interface ContainerDetail {
  container_size: string;
  container_type: string;
  quantity: number;
  container_numbers: string[];
  seal_numbers: string[];
  container_number?: string | null;   // BL-enriched
  seal_number?: string | null;        // BL-enriched
}
```

Step 2 — replace the container row map inside the SEA_FCL branch of TypeDetailsCard.

Find this block (the containers.map):
```tsx
{fcl.containers.map((c, i) => (
  <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
    <div className="flex items-center gap-2">
      <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs font-mono font-semibold text-[var(--text-mid)]">
        {c.container_size}
      </span>
      <span className="text-sm text-[var(--text-mid)]">{c.container_type}</span>
    </div>
    <span className="text-sm font-semibold text-[var(--text)]">× {c.quantity}</span>
  </div>
))}
```

Replace with:
```tsx
{fcl.containers.map((c, i) => {
  const containerNum = c.container_number ?? null;
  const sealNum = c.seal_number ?? null;
  const legacyNums = c.container_numbers ?? [];
  const legacySeals = c.seal_numbers ?? [];
  return (
    <div key={i} className="py-2 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {c.container_size && (
            <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs font-mono font-semibold text-[var(--text-mid)]">
              {c.container_size}
            </span>
          )}
          <span className="text-sm text-[var(--text-mid)]">{c.container_type}</span>
        </div>
        {c.quantity && <span className="text-sm font-semibold text-[var(--text)]">x {c.quantity}</span>}
      </div>
      {containerNum && (
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">Container No.</span>
          <span className="font-mono text-[var(--text)]">{containerNum}</span>
        </div>
      )}
      {sealNum && (
        <div className="mt-0.5 flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">Seal No.</span>
          <span className="font-mono text-[var(--text)]">{sealNum}</span>
        </div>
      )}
      {legacyNums.map((n, j) => (
        <div key={j} className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">Container No.</span>
          <span className="font-mono text-[var(--text)]">{n}</span>
        </div>
      ))}
      {legacySeals.map((s, j) => (
        <div key={j} className="mt-0.5 flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">Seal No.</span>
          <span className="font-mono text-[var(--text)]">{s}</span>
        </div>
      ))}
    </div>
  );
})}
```

Step 3 — update the footer hint. Find:
```tsx
<p className="text-xs text-[var(--text-muted)] mt-3">Container and seal numbers assigned at booking.</p>
```

Replace with:
```tsx
{fcl.containers.every(c => !c.container_number && (!c.container_numbers || c.container_numbers.length === 0)) && (
  <p className="text-xs text-[var(--text-muted)] mt-3">Container and seal numbers assigned at booking.</p>
)}
```

---

## Acceptance Criteria
- AF-003837: Containers card shows 40HQ with SEGU6868838 and seal YMAV438141 after page reload
- AF-003872: pre-BL Containers card still shows 20GP DRY x 1 with hint text
- No TypeScript build errors
