# PROMPT-CURRENT — v2.81
**Date:** 03 March 2026
**Status:** READY — pass to Opus in VS Code

---

## Context

This prompt migrates all user data operations from Google Cloud Datastore to
PostgreSQL, completing the Datastore removal for the core platform. After this
prompt, Datastore is no longer used for any read or write operations — DS-03
closes automatically.

Firebase Auth remains unchanged — it is the identity provider and is not
being replaced. Only the user profile data storage moves to PostgreSQL.

---

## Current State

User data currently lives in three Datastore Kinds:

| Kind | Key | Purpose |
|---|---|---|
| `UserAccount` | uid | Profile: name, email, phone, account_type, email_validated |
| `UserIAM` | uid | Access: role, valid_access, active, last_login |
| `CompanyUserAccount` | uid | Company link: company_id (AFC users only) |

These are read by:
- `af-platform/src/lib/users.ts` — `getUsers()` — list all users (Datastore direct)
- `af-platform/src/app/actions/users.ts` — all write actions (Datastore direct)
- `af-server/core/auth.py` — `_build_claims()` — reads UserIAM + UserAccount + CompanyUserAccount on every authenticated request (Datastore direct)
- `af-platform/src/app/actions/users.ts` — `getCurrentUserProfileAction()` — reads Datastore on every profile load

The `af-server/routers/users.py` is currently a stub returning an empty list.

---

## Target State

### 1. PostgreSQL table — `users`

Create the following table. The `uid` is the Firebase Auth UID (string) — it is
the primary key and matches across Firebase and PostgreSQL.

```sql
CREATE TABLE IF NOT EXISTS users (
    uid                 TEXT PRIMARY KEY,
    email               TEXT NOT NULL UNIQUE,
    first_name          TEXT NOT NULL DEFAULT '',
    last_name           TEXT NOT NULL DEFAULT '',
    phone_number        TEXT,
    account_type        TEXT NOT NULL DEFAULT 'AFC',   -- 'AFU' | 'AFC'
    role                TEXT NOT NULL DEFAULT '',       -- 'AFU-ADMIN' | 'AFU-SM' | 'AFU-SE' | 'AFC-ADMIN' | 'AFC-M'
    company_id          TEXT,                           -- NULL for AFU users, AFC-XXXXX for AFC users
    valid_access        BOOLEAN NOT NULL DEFAULT TRUE,
    email_validated     BOOLEAN NOT NULL DEFAULT FALSE,
    last_login          TEXT,                           -- ISO datetime string
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

---

### 2. Migration script — `af-server/scripts/migrate_users.py`

Write a migration script that:

1. Reads all `UserAccount` entities from Datastore
2. For each, fetches the corresponding `UserIAM` and `CompanyUserAccount`
3. Upserts into the `users` PostgreSQL table
4. Prints a summary: total processed, inserted, skipped (already exists), errors

Use `--dry-run` flag to preview without writing.

The script must handle:
- Missing `UserIAM` (set `valid_access=True`, `role=''`)
- Missing `CompanyUserAccount` (set `company_id=NULL`)
- Duplicate emails — AFU (staff) takes priority over AFC (customer), matching
  the deduplication logic in `lib/users.ts`

---

### 3. `af-server/core/auth.py` — rewrite `_build_claims()`

Replace the three Datastore reads with a single PostgreSQL query:

```python
async def _build_claims(decoded_token: dict) -> Claims:
    uid = decoded_token.get("uid")
    email = decoded_token.get("email", "")

    from core.db import get_db_direct
    conn = get_db_direct()

    row = conn.execute(
        text("SELECT account_type, role, company_id, valid_access FROM users WHERE uid = :uid"),
        {"uid": uid}
    ).fetchone()

    if not row or not row.valid_access:
        raise HTTPException(status_code=403, detail="User account not found or access revoked")

    return Claims(
        uid=uid,
        email=email,
        account_type=row.account_type,
        role=row.role,
        company_id=row.company_id,
    )
```

`get_db_direct()` must be a synchronous connection getter (not the FastAPI
`Depends` version) since `_build_claims` is called inside an async function
but needs a sync DB call. Add `get_db_direct()` to `core/db.py` if it does
not already exist — it should return a connection from the same engine used
by `get_db`.

---

### 4. `af-server/routers/users.py` — full implementation

Replace the stub with a complete users router:

#### `GET /users` — list all users (AFU-ADMIN only)
```python
SELECT u.*, c.name AS company_name, c.short_name AS company_short_name
FROM users u
LEFT JOIN companies c ON c.id = u.company_id
ORDER BY
    CASE WHEN u.account_type = 'AFU' THEN 0 ELSE 1 END,
    u.last_name ASC
```

Returns array of user objects matching the `UserRecord` shape in `lib/types.ts`.

#### `POST /users` — create user (AFU-ADMIN only)
Accepts: `email`, `password`, `first_name`, `last_name`, `phone_number`,
`account_type`, `role`, `company_id`

Steps:
1. Create Firebase Auth user (same as current `createUserAction`)
2. INSERT into `users` table
3. Return `{ uid }`

#### `PATCH /users/{uid}` — update user (AFU-ADMIN only)
Accepts any subset of: `first_name`, `last_name`, `phone_number`, `role`,
`valid_access`, `company_id`

Steps:
1. UPDATE `users` table
2. If `valid_access` changed: update Firebase Auth `disabled` flag accordingly
3. If name changed: sync Firebase Auth `displayName`

#### `DELETE /users/{uid}` — delete user (AFU-ADMIN only)
1. Delete Firebase Auth user
2. DELETE from `users` table

#### `POST /users/{uid}/reset-password` — reset password (AFU-ADMIN only)
Accepts: `{ new_password: str }`
Calls `admin.auth().update_user(uid, password=new_password)`

#### `POST /users/{uid}/send-reset-email` — send password reset email (AFU-ADMIN only)
Calls Firebase REST API to send password reset email (same logic as current
`sendPasswordResetEmailAction`).

All write endpoints must log to `system_logs` using `_log_system_action_pg`.

---

### 5. `af-platform/src/lib/users.ts` — rewrite to call af-server

Replace all Datastore reads with a call to the af-server `/users` endpoint:

```typescript
export async function getUsers(): Promise<UserRecord[]> {
  const res = await fetchFromServer('/users');  // use existing af-server fetch helper
  return res.data ?? [];
}
```

The `UserRecord` shape must remain identical — no changes to the frontend
components that consume it.

---

### 6. `af-platform/src/app/actions/users.ts` — rewrite all write actions

Replace all Datastore writes with calls to the af-server endpoints:

| Action | Endpoint |
|---|---|
| `createUserAction` | `POST /users` |
| `updateUserAction` | `PATCH /users/{uid}` |
| `deactivateUserAction` | `PATCH /users/{uid}` `{ valid_access: false }` |
| `reactivateUserAction` | `PATCH /users/{uid}` `{ valid_access: true }` |
| `deleteUserAction` | `DELETE /users/{uid}` |
| `resetPasswordAction` | `POST /users/{uid}/reset-password` |
| `sendPasswordResetEmailAction` | `POST /users/{uid}/send-reset-email` |
| `getCurrentUserProfileAction` | `GET /users/me` (new endpoint — see below) |

---

### 7. `af-server/routers/users.py` — add `GET /users/me`

```python
@router.get("/me")
async def get_current_user(claims: Claims = Depends(require_auth)):
    """Return the current authenticated user's profile."""
```

Returns the same shape as the list endpoint but for a single user. This
replaces the Datastore reads in `getCurrentUserProfileAction`.

Register `/me` BEFORE `/{uid}` in the router to avoid route conflict.

---

### 8. Remove Datastore dependency from af-platform

After the above rewrites, `af-platform/src/lib/users.ts` and
`af-platform/src/app/actions/users.ts` must have zero imports from:
- `@/lib/datastore`
- `@/lib/datastore-query`

Verify that no other files in af-platform import these for user operations.
Do NOT remove the datastore imports from auth-related files — those are
handled separately.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `af-server/scripts/migrate_users.py` | CREATE |
| `af-server/core/auth.py` | MODIFY — rewrite `_build_claims()` |
| `af-server/core/db.py` | MODIFY — add `get_db_direct()` if missing |
| `af-server/routers/users.py` | REWRITE — full implementation |
| `af-platform/src/lib/users.ts` | REWRITE — call af-server |
| `af-platform/src/app/actions/users.ts` | REWRITE — call af-server endpoints |

---

## Critical Rules

1. **Firebase Auth is NOT replaced** — uid, email, password, displayName still
   live in Firebase. PostgreSQL stores profile + access data only.
2. **`getCurrentUserProfileAction` must remain functional** — it is called on
   every page load for the nav header. The `GET /users/me` endpoint must be fast.
3. **`_build_claims()` is on the hot path** — called on every authenticated
   request. The PostgreSQL query must use the `uid` primary key — no JOINs,
   no full table scans.
4. **UserRecord shape is unchanged** — frontend components must not need updating.
5. **Do not remove `core/datastore.py`** — it may still be referenced by other
   parts of the system. Only remove the Datastore calls from the user-specific files.
6. **Run the migration script before deploying** — the `users` table must be
   populated before `_build_claims()` switches to PostgreSQL, or all logins will
   fail.
7. **DS-03 closes** when `datastore-query.ts` is no longer imported by any
   users module.

---

## Verification Steps

After completing the migration:

1. Run `migrate_users.py` — confirm all users inserted with correct data
2. `npm run dev` — zero TypeScript errors
3. Log in — session works, nav header shows correct name
4. Navigate to `/users` — full user list renders with correct roles/companies
5. Create a new AFC user — appears in list, can log in
6. Deactivate a user — `valid_access` set to false, login blocked
7. Reset password — user can log in with new password
8. `getCurrentUserProfileAction` returns correct profile data
9. DS-03 test marked YES — no Datastore imports in users module

---

## Notes

- This is the last major Datastore migration. After v2.81, only `core/auth.py`
  historically touched Datastore — and that is replaced here.
- `core/datastore.py` is kept but becomes unused after this prompt. It will be
  removed in the post-migration cleanup (v2.83 or dedicated cleanup session).
- v2.82 follows with the 4 bug fixes logged this session.
