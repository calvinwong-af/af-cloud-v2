# AF API Contract — Companies & Users (Sections 3 & 4)
*See AF-API-Index.md for conventions, auth roles, and auth map.*

---

## 3. Companies

Base path: `/api/v2/companies`

### 3.1 List Companies

#### `GET /companies`
Auth: `require_afu`  
Query params: `search` (optional), `limit` (default 200, max 500)

**Response:**
```json
{
  "status": "OK",
  "data": [ <CompanyRecord>, ... ],
  "msg": "200 companies"
}
```

### 3.2 Company Stats

#### `GET /companies/stats`
Auth: `require_afu`

**Response:**
```json
{
  "status": "OK",
  "data": { "total": 641, "approved": 589, "with_access": 412, "xero_synced": 398 }
}
```

### 3.3 Get Company

#### `GET /companies/{company_id}`
Auth: `require_auth`

**Response:**
```json
{
  "status": "OK",
  "data": {
    "company_id": "AFC-000412",
    "id": "AFC-000412",
    "name": "Acme Corp Sdn Bhd",
    "short_name": "Acme",
    "account_type": "AFC",
    "email": "admin@acme.com",
    "phone": "+60 3 1234 5678",
    "address": { "line1": "Suite 5A, Menara ABC", "city": "Petaling Jaya", "state": "Selangor", "postcode": "47810", "country": "Malaysia" },
    "xero_contact_id": "uuid...",
    "approved": true,
    "has_platform_access": true,
    "trash": false,
    "created_at": "2023-01-15T08:00:00+00:00",
    "updated_at": "2026-02-01T10:00:00+00:00"
  }
}
```

### 3.4 Create Company

#### `POST /companies`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "id": "AFC-000642",
  "name": "New Logistics Sdn Bhd",
  "short_name": "NewLog",
  "account_type": "AFC",
  "email": "info@newlog.com",
  "phone": "+60 3 9876 5432"
}
```

**Response:** `{ "status": "OK", "data": { "company_id": "AFC-000642", "name": "New Logistics Sdn Bhd" }, "msg": "Company created" }`

### 3.5 Update Company

#### `PATCH /companies/{company_id}`
Auth: `require_afu`  
Updatable fields: `name`, `short_name`, `email`, `phone`, `approved`, `has_platform_access`.

**Response:** `{ "status": "OK", "msg": "Company updated" }`

---

## 4. Users

Base path: `/api/v2/users`

### User Record Shape

```json
{
  "uid": "firebase_uid_abc",
  "email": "user@company.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+60 12 345 6789",
  "account_type": "AFC",
  "role": "AFC-M",
  "company_id": "AFC-000412",
  "company_name": "Acme Corp Sdn Bhd",
  "valid_access": true,
  "validated": false,
  "last_login": null,
  "created_at": "2024-06-01T08:00:00+00:00"
}
```

`company_name` resolved from `companies.short_name` (falls back to `companies.name`). `validated` = `email_validated` column.

### 4.1 Get Current User

#### `GET /users/me`
Auth: `require_auth`

**Response:** `{ "status": "OK", "data": <UserRecord> }`

### 4.2 List Users

#### `GET /users`
Auth: `require_afu_admin`  
Returns all users — AFU first, then alphabetical by last name.

**Response:** `{ "status": "OK", "data": [ <UserRecord>, ... ] }`

### 4.3 Create User

#### `POST /users`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "email": "newuser@company.com",
  "password": "InitialPassword123!",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone_number": "+60 12 345 6789",
  "account_type": "AFC",
  "role": "AFC-M",
  "company_id": "AFC-000412"
}
```

`phone_number` and `company_id` are optional.

**Response:** `{ "status": "OK", "data": { "uid": "firebase_uid_abc" } }`

**Errors:** `409` — email exists. `400` — weak password or invalid email.

### 4.4 Update User

#### `PATCH /users/{uid}`
Auth: `require_afu_admin`  
Updatable: `first_name`, `last_name`, `phone_number`, `role`, `valid_access`, `company_id`. Syncs to Firebase Auth.

⚠️ `valid_access: false` disables Firebase Auth immediately.

**Response:** `{ "status": "OK" }`

### 4.5 Delete User

#### `DELETE /users/{uid}`
Auth: `require_afu_admin`  
Permanently deletes from Firebase Auth and `users` table.

**Response:** `{ "status": "OK" }`

### 4.6 Reset Password

#### `POST /users/{uid}/reset-password`
Auth: `require_afu_admin`

**Request body:** `{ "new_password": "NewSecure456!" }`

**Response:** `{ "status": "OK" }`

### 4.7 Send Password Reset Email

#### `POST /users/{uid}/send-reset-email`
Auth: `require_afu_admin`

**Response:** `{ "status": "OK" }`

**Errors:** `404` — user not found. `400` — no email. `502` — Firebase call failed.

### 4.8 Promote to Staff

#### `PATCH /users/{uid}/promote-to-staff`
Auth: `require_afu_admin`

Promotes a customer (AFC) user to an internal staff (AFU) account. Sets `account_type = 'AFU'`, assigns role, and clears `company_id`.

**Request body:**
```json
{ "role": "AFU-STAFF" }
```

`role` must be one of: `AFU-ADMIN` | `AFU-STAFF` | `AFU-OPS`

**Response:** `{ "status": "OK" }`

**Errors:** `400` — invalid role or user is already AFU. `404` — user not found.
