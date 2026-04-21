# Tenant Preset & Bundle System — Design Spec

## Problem

Per-tenant feature flag overrides (see `tenant-feature-flag.md`) solve the "single flag, single tenant" case. But we also need to:

- Package multiple features together as a sellable or assignable **bundle**
- Apply a consistent **preset** (a named configuration template) to a tenant in one operation
- Support **trials** (time-limited access), **purchases** (billing-linked), and **internal grants** (beta/preview, platform-staff only)
- Allow **manual per-tenant overrides** that coexist with or supersede preset-driven config
- Let presets change over time without silently breaking tenant assignments

---

## Core Concepts

### `FeaturePreset` — The Product Definition

A named, versioned template that declares which feature flags it configures and how. Think of it as a "product SKU" in your feature catalog.

```
starter     → loginWithCredential=on, signUp=on
pro         → starter + analytics=on(config: sampleRate=0.1), trip=on
enterprise  → pro + advancedReporting=on, customDomain=on
trial-pro   → same as pro, but expires in 30 days
beta        → experimental=on, edgeFeatures=on  [internal only]
```

Presets are **immutable in production** once assigned to tenants. Changing a preset's items creates a new version (or a new key) — existing assignments are unaffected until explicitly migrated.

### `TenantPresetAssignment` — The Lifecycle Record

Tracks that tenant X has been given preset Y, when, how (manual/purchase/system), and until when (if trial). This is the audit trail and expiry source of truth.

### `TenantFeatureFlag` — The Effective Runtime State

What the guard actually reads. A single row per `(tenantId, flagKey)`. This is **materialized** from active preset assignments and manual overrides at write time, not resolved at read time. The guard stays a simple unique-index lookup — no join, no multi-row resolution.

### Precedence (resolved at write, not at read)

```
Global FeatureFlag.isEnable = false  →  nobody gets it (guard enforces, overrides ignored)

For the TenantFeatureFlag row:
  1. Manual override  (source = manual)   wins always
  2. Highest-priority active preset       wins among presets
  3. No row                               falls back to global behavior
```

Manual overrides are never overwritten by preset operations. Preset operations are never overwritten by a lower-priority preset. Only a higher-priority preset or a manual override can displace an existing preset-sourced row.

---

## Schema

```prisma
// Platform-defined feature template (product catalog)
model FeaturePreset {
  id          String  @id @default(auto()) @map("_id") @db.ObjectId
  key         String  @unique         // slug, e.g. 'pro', 'trial-analytics', 'beta'
  name        String
  description String
  type        String                  // public | trial | internal  (see EnumFeaturePresetType)
  isActive    Boolean @default(true)  // false = cannot be assigned to new tenants
  priority    Int     @default(0)     // higher wins in conflict resolution
  trialDays   Int?                    // only meaningful when type = trial
  metadata    Json?                   // extensible: pricing hints, display info, etc.

  createdAt DateTime @default(now())
  createdBy String?  @db.ObjectId
  updatedAt DateTime @updatedAt
  updatedBy String?  @db.ObjectId

  @@index(fields: [type])
  @@index(fields: [isActive])
  @@map("FeaturePresets")
}

// Per-flag configuration declared by a preset
model FeaturePresetItem {
  id       String  @id @default(auto()) @map("_id") @db.ObjectId
  presetId String  @db.ObjectId
  flagKey  String  // references FeatureFlag.key
  isEnable Boolean
  config   Json?   // feature-specific configuration payload

  @@unique(fields: [presetId, flagKey])
  @@index(fields: [presetId])
  @@map("FeaturePresetItems")
}

// Assignment of a preset to a tenant (lifecycle + audit)
model TenantPresetAssignment {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId    String   @db.ObjectId
  presetId    String   @db.ObjectId
  presetKey   String   // denormalized for readability in audit logs
  source      String   // manual | purchase | system  (see EnumTenantPresetSource)
  externalRef String?  // e.g. Stripe subscription ID, invoice ID
  assignedBy  String?  @db.ObjectId
  assignedAt  DateTime @default(now())
  expiresAt   DateTime?              // null = permanent
  isActive    Boolean  @default(true)
  revokedAt   DateTime?
  revokedBy   String?  @db.ObjectId

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index(fields: [tenantId])
  @@index(fields: [presetId])
  @@index(fields: [expiresAt])  // for expiry background job
  @@index(fields: [isActive])
  @@map("TenantPresetAssignments")
}

// Effective runtime state — what the guard reads (materialized)
// Extends the TenantFeatureFlag model from tenant-feature-flag.md
model TenantFeatureFlag {
  id                  String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId            String   @db.ObjectId
  flagKey             String
  isEnable            Boolean
  config              Json?
  source              String   // manual | preset | system
  presetAssignmentId  String?  @db.ObjectId   // set when source = preset
  expiresAt           DateTime?               // synced from assignment when source = preset

  createdAt DateTime @default(now())
  createdBy String?  @db.ObjectId
  updatedAt DateTime @updatedAt
  updatedBy String?  @db.ObjectId

  @@unique(fields: [tenantId, flagKey])
  @@index(fields: [tenantId])
  @@index(fields: [presetAssignmentId])
  @@index(fields: [expiresAt])
  @@map("TenantFeatureFlags")
}
```

---

## Enums

```typescript
enum EnumFeaturePresetType {
    public   = 'public',    // purchasable, visible in pricing pages
    trial    = 'trial',     // time-limited; can be self-serve or staff-assigned
    internal = 'internal',  // beta/preview; only platform staff can assign
}

enum EnumTenantPresetSource {
    manual   = 'manual',    // directly assigned by platform admin
    purchase = 'purchase',  // triggered by billing event (e.g. Stripe webhook)
    system   = 'system',    // automated (onboarding flow, migration, etc.)
}

enum EnumTenantFeatureFlagSource {
    manual = 'manual',  // direct override, never touched by preset ops
    preset = 'preset',  // written by preset materialization
    system = 'system',  // written by platform automation
}
```

---

## Preset Types in Detail

### `public` — Purchasable Plans

Visible to customers, tied to billing. Assigned via purchase event. Permanent until cancelled/downgraded. Example: `starter`, `pro`, `enterprise`.

- `expiresAt = null` (billing cancellation triggers explicit revocation)
- `source = purchase`
- `externalRef = stripe_subscription_id`

### `trial` — Time-Limited Access

Can be assigned manually by staff or triggered by a signup flow. `trialDays` on the preset defines the default duration. Assignment sets `expiresAt = now + trialDays`. A background job revokes expired assignments.

- `expiresAt = assigned_at + preset.trialDays days`
- `source = manual | system`
- Guard reads `TenantFeatureFlag.expiresAt` and treats an expired row as absent

### `internal` — Beta / Preview

Only platform staff can assign (enforced at API layer by `type = internal` guard or policy check). Not visible externally. Examples: `beta`, `preview-dashboard`, `edge-runtime`.

- No expiry required (but supported)
- `source = manual | system`
- No self-serve assignment path

---

## Materialization Algorithm

When **assigning** a preset to a tenant (on `TenantPresetAssignmentService.assign`):

```
1. Load all FeaturePresetItems for the preset
2. For each item (flagKey, isEnable, config):
   a. Find existing TenantFeatureFlag for (tenantId, flagKey)
   b. If existing.source = 'manual' → skip (manual always wins)
   c. If existing.source = 'preset' and existing preset has higher priority → skip
   d. Otherwise → upsert TenantFeatureFlag with:
        isEnable = item.isEnable
        config   = item.config
        source   = 'preset'
        presetAssignmentId = assignment.id
        expiresAt = assignment.expiresAt
3. Invalidate cache for each written (tenantId, flagKey)
```

When **revoking** a preset (expiry, cancellation, manual revocation):

```
1. Set TenantPresetAssignment.isActive = false, revokedAt = now
2. Find all TenantFeatureFlag where presetAssignmentId = assignment.id
3. For each row:
   a. Find next-best active assignment for this tenant that covers this flagKey
      (active TenantPresetAssignment → FeaturePresetItem match, sorted by preset.priority desc)
   b. If found → overwrite TenantFeatureFlag with that preset's config
   c. If not found → delete TenantFeatureFlag row (falls back to global)
4. Invalidate cache for each affected (tenantId, flagKey)
```

When **manual override** is set by admin:

```
1. Upsert TenantFeatureFlag with source = 'manual', no presetAssignmentId, no expiresAt
2. Invalidate cache for (tenantId, flagKey)
(No interaction with preset assignments — they remain active but dormant for this flag)
```

When **manual override** is removed:

```
1. Delete TenantFeatureFlag where source = 'manual'
2. Re-evaluate: find best active preset assignment for this flag → if found, materialize
3. Invalidate cache
```

---

## Guard Impact (Minimal)

The guard already reads a single `TenantFeatureFlag` by unique index. One additional check needed: **expiry**.

```
guard step 3 (tenant override):
  row = await tenantFeatureFlagUtil.getByTenantAndKeyAndCache(tenantId, keys[0])
  if (row)
    if (row.expiresAt && row.expiresAt <= now) → treat as absent (trial expired)
    else if (!row.isEnable) → throw 503
    else → skip rollout, pass
```

Expired rows are "soft-invisible" to the guard. A background job handles actual cleanup asynchronously — no hard dependency on the job for correctness.

---

## Admin API Shape

### Preset Management (platform staff only)

```
GET    /admin/v1/feature-presets/list
POST   /admin/v1/feature-presets               { key, name, description, type, priority, trialDays?, metadata? }
GET    /admin/v1/feature-presets/:key
PATCH  /admin/v1/feature-presets/:key          { name, description, isActive }  (items immutable once assigned)
GET    /admin/v1/feature-presets/:key/items
PUT    /admin/v1/feature-presets/:key/items    replace item list (only if no active assignments)
```

### Assignment Management

```
GET    /admin/v1/tenant-preset-assignments/list                   all assignments (filterable by tenantId, presetKey, isActive)
GET    /admin/v1/tenant-preset-assignments/:tenantId/list         assignments for one tenant
POST   /admin/v1/tenant-preset-assignments/:tenantId/assign       { presetKey, source, expiresAt?, externalRef? }
DELETE /admin/v1/tenant-preset-assignments/:assignmentId/revoke   revoke one assignment
```

### Manual Feature Override (unchanged from tenant-feature-flag.md)

```
PUT    /admin/v1/tenant-feature-flags/:tenantId/:flagKey    { isEnable, config? }
DELETE /admin/v1/tenant-feature-flags/:tenantId/:flagKey
```

---

## Background Jobs

### `TenantPresetExpiryProcessor`

- Queue: existing BullMQ infrastructure
- Trigger: scheduled (e.g., every 5 minutes) or event-based (delayed job created at assignment time)
- Logic: find assignments where `isActive = true AND expiresAt <= now`, revoke each

Prefer **delayed job at assignment time** over polling — schedule a BullMQ job with `delay = expiresAt - now` when a trial is assigned. Job id = `assignment:{id}:expire` for idempotency. Cancellable if assignment is revoked early.

---

## Module Structure

```
src/modules/feature-preset/
    feature-preset.module.ts
    repositories/
        feature-preset.repository.ts
        feature-preset-item.repository.ts
    services/
        feature-preset.service.ts       implements IFeaturePresetService
    interfaces/
        feature-preset.service.interface.ts
    enums/
        feature-preset.status-code.enum.ts
        feature-preset.enum.ts          EnumFeaturePresetType
    dtos/ controllers/ docs/

src/modules/tenant-preset-assignment/
    tenant-preset-assignment.module.ts
    repositories/
        tenant-preset-assignment.repository.ts
    services/
        tenant-preset-assignment.service.ts    // owns materialization algorithm
    processors/
        tenant-preset-expiry.processor.ts
    enums/
        tenant-preset-assignment.enum.ts       EnumTenantPresetSource
    dtos/ controllers/ docs/
```

`TenantFeatureFlagModule` (from the prior spec) stays independent. The assignment service imports and calls `TenantFeatureFlagRepository` directly to materialize rows — no circular dependency.

---

## Invariants & Guard-Rails

| Rule | Enforced where |
|------|---------------|
| Manual overrides survive preset changes | Materialization algorithm checks `source = 'manual'` |
| `internal` presets unassignable via public API | Policy check on `POST assign` — validates preset.type |
| Preset items immutable when assignments active | `PUT items` endpoint checks for active assignments |
| One effective row per (tenantId, flagKey) | `@@unique([tenantId, flagKey])` on `TenantFeatureFlag` |
| Global flag = master switch | Guard checks global first, before tenant row |
| Expired trial = no access | Guard checks `expiresAt` inline |
| Cache coherence on write | All materialization paths call `deleteCacheByTenantAndKey` |

---

## What This Does NOT Solve (Future)

- **Self-serve trial activation** — needs a public/user-facing API + rate limiting + verification that tenant hasn't trialed this before
- **Billing webhooks** — `purchase` source assignments need a webhook processor (Stripe → `TenantPresetAssignmentService.assign`)
- **Preset versioning** — currently avoided by "immutable once assigned" rule; if needed, add `version: Int` to `FeaturePreset` and track which version each assignment is pinned to
- **Usage metering** — `config: Json?` on `FeaturePresetItem` and `TenantFeatureFlag` can carry quota/limit values, but enforcing them requires per-feature instrumentation
- **Tenant-initiated downgrade** — needs business rules around what happens to data when features are removed
