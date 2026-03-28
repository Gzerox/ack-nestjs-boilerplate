---
title: Feature Flag Preset System — Implementation Spec v1
status: developing
stage: spec
feature_id: feature-flag-preset
owner: product
last_reviewed: 2026-03-27
note_type: implementation-spec
---

# Feature Flag Preset System — Implementation Spec v1

## Goal

Extend the existing global `FeatureFlag` system with a **two-phase tenant-scoped stacking mechanism** that allows the platform to assign different feature configurations per tenant — without changing the guard API, without breaking existing behavior, and with a clear extension path toward named, reusable preset bundles.

## Core Idea: Layered Resolution

The system operates as a **resolution stack**. When a feature flag is evaluated for a request, the resolver walks the stack from most-specific to least-specific and returns the first matching active configuration:

```
Priority 1 — Direct tenant override   (TenantFeatureFlagConfig)
Priority 2 — Preset-provided override (TenantFeatureFlagPreset → FeatureFlagPreset)   [Phase 2]
Priority 3 — Global platform default  (FeatureFlag)
```

Each layer can override `isEnabled` and `config` (metadata) independently. A layer that provides `null` for either field defers that field to the next layer down. Resolution is computed at request time, cached per `(flagKey, tenantId)` for 1 hour, and invalidated on any write to any layer.

The `@FeatureFlagProtected('key')` decorator signature is **unchanged across both phases**. Tenant context is injected automatically from the JWT at evaluation time.

---

## Phase 1 — Direct Tenant Override

### What it is

A simple per-tenant, per-flag override record. The platform assigns a specific `isEnabled` state and/or `config` blob for a `(tenantId, flagKey)` pair. There is no grouping, no catalog, no naming — just a direct override of a single flag for a single tenant.

This is the minimum viable stacking primitive and is fully useful on its own without Phase 2.

### When to use

- Override a flag's `isEnabled` for a specific tenant without affecting others.
- Give a tenant a different `config` (metadata) value for a flag (e.g. `maxSubmissions: 500` vs the global default of `100`).
- Apply a time-windowed activation for a tenant trial or promotional period.

### Data Model

```prisma
model TenantFeatureFlagConfig {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId

  // The tenant this override applies to.
  // Soft reference to the Agency/Tenant model — no FK enforced at DB level.
  // Must be validated at application layer (agency must exist before creating override).
  tenantId  String    @db.ObjectId

  // The FeatureFlag.key this override targets.
  // Soft reference — no FK. Validated at application layer (flag must exist).
  // Using a soft ref keeps the override model decoupled from the flag catalog,
  // so a flag can be deleted without cascading orphan side effects.
  flagKey   String

  // When null: inherit isEnable from the global FeatureFlag.
  // When set: explicitly enables or disables the flag for this tenant,
  // regardless of the global state.
  // A false value here will disable the flag for this tenant even if the
  // global flag is enabled (and even if a preset would enable it — direct
  // overrides are always highest priority).
  isEnabled Boolean?

  // When null: inherit metadata from the global FeatureFlag.
  // When set: REPLACES (does not deep-merge) the global metadata for this tenant.
  // Replacement semantics are intentional — merging partial JSON is implicit
  // and hard to reason about. If you need partial overrides, provide the full
  // desired config object.
  config    Json?

  // Optional activation window. Both fields are independently optional.
  // - If startsAt is null: override is active immediately from creation.
  // - If endsAt is null: override has no expiry.
  // - If both are set: startsAt must be strictly before endsAt.
  // - At exact endsAt, the override is considered inactive (exclusive upper bound).
  // Outside an active window, the override is ignored and the resolver falls
  // through to the next priority layer.
  startsAt  DateTime?
  endsAt    DateTime?

  // Audit fields
  createdBy String?   @db.ObjectId
  updatedBy String?   @db.ObjectId
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  // One override record per (tenant, flag) pair.
  // To change a tenant's flag config, update the existing record — do not insert a new one.
  @@unique([tenantId, flagKey])

  // Primary lookup path: resolve a specific flag for a specific tenant.
  @@index([tenantId, flagKey])

  // Secondary lookups: list all overrides for a tenant, or find all tenants
  // overriding a specific flag (for impact analysis before changing a global flag).
  @@index([tenantId])
  @@index([flagKey])

  @@map("TenantFeatureFlagConfigs")
}
```

### Resolution Algorithm (Phase 1)

```
resolveFlag(flagKey, tenantId?, userId?):

  1. Load global FeatureFlag by flagKey (from cache: FeatureFlag:{flagKey}).
     If not found → throw NotFoundException.

  2. If tenantId is present:
       Load TenantFeatureFlagConfig where:
         - tenantId = tenantId
         - flagKey  = flagKey
         - (startsAt IS NULL OR startsAt <= now())
         - (endsAt   IS NULL OR now() < endsAt)
       Cache key: FeatureFlag:{flagKey}:Tenant:{tenantId}  TTL: 1h

  3. Compute effective state:
       effectiveIsEnabled = override?.isEnabled ?? global.isEnable
       effectiveConfig    = override?.config    ?? global.metadata

  4. If effectiveIsEnabled = false → throw ServiceUnavailableException (503).

  5. If keyPath has metadata segment (e.g. 'form.maxSubmissions'):
       Read effectiveConfig[metadataKey].
       If not boolean or not true → throw ServiceUnavailableException (503).

  6. Rollout check (only when NO active tenant override exists):
       If userId present AND global.rolloutPercent < 100:
         Compute md5(userId), check deterministic bucket.
         If outside rollout → throw ServiceUnavailableException (503).
       Rollout is skipped when a tenant override is active because the override
       represents an explicit, deliberate assignment — rollout noise is irrelevant.
```

### Cache Strategy (Phase 1)

| Cache Key | Content | TTL | Invalidated When |
|---|---|---|---|
| `FeatureFlag:{flagKey}` | Global FeatureFlag record | 1h | Global flag updated |
| `FeatureFlag:{flagKey}:Tenant:{tenantId}` | TenantFeatureFlagConfig record (or null sentinel) | 1h | Override upserted or deleted |

Cache null sentinels (a record indicating no override exists) to avoid repeated DB misses for tenants without overrides.

### Admin API (Phase 1)

All endpoints require platform operator role.

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tenants/:tenantId/feature-flags` | List all active overrides for a tenant |
| `PUT` | `/admin/tenants/:tenantId/feature-flags/:flagKey` | Upsert override (create or update) |
| `DELETE` | `/admin/tenants/:tenantId/feature-flags/:flagKey` | Remove override → reverts to global |

**`PUT` validation rules:**
1. `flagKey` must exist in the `FeatureFlag` collection.
2. `tenantId` must reference an existing tenant.
3. When both `startsAt` and `endsAt` are provided: `startsAt` must be strictly before `endsAt`.
4. When `config` is provided: all keys must be a strict subset of the global `metadata` keys. Prevents inventing new keys that have no global definition.

### Tenant Read-Only API (Phase 1)

| Method | Path | Description |
|---|---|---|
| `GET` | `/shared/tenants/current/feature-flags` | Computed effective flag state for the current tenant |

Returns the fully resolved flag list — global defaults merged with active tenant overrides. Tenants see the effective result only; they cannot see whether a value comes from an override or the global default.

---

## Phase 2 — FeatureFlagPreset (Named Bundle)

### What it is

A **FeatureFlagPreset** is a named, platform-managed template that declares a set of flag overrides to apply as a unit. When a preset is assigned to a tenant (`TenantFeatureFlagPreset`), its declared flag overrides are applied to that tenant as a new layer in the resolution stack — sitting below direct tenant overrides but above global defaults.

Presets are useful when the same flag configuration needs to be applied consistently to many tenants (e.g. a "Pro" tier, a "Beta tester" group, a partner-specific configuration). Instead of creating individual `TenantFeatureFlagConfig` records per tenant per flag, you define the bundle once and assign it.

### Phase 1 vs Phase 2 — what changes

| Concern | Phase 1 | Phase 2 |
|---|---|---|
| Override primitive | `TenantFeatureFlagConfig` | Same, unchanged |
| Named bundle | Not available | `FeatureFlagPreset` (catalog) |
| Tenant assignment | Direct override only | Also `TenantFeatureFlagPreset` (preset assignment) |
| Resolution stack depth | 2 layers | 3 layers |
| Conflict detection | Uniqueness constraint | Conflict check at assignment time |
| Guard / decorator | Unchanged | Unchanged |

Phase 1 records remain **highest priority** in Phase 2. A direct tenant override always beats a preset-provided value. This means Phase 1 is never made obsolete — it becomes the "admin fine-tuning" layer above presets.

### Data Models

#### `FeatureFlagPreset` — the catalog entry

```prisma
model FeatureFlagPreset {
  // Human-readable unique identifier. Open string — not an enum.
  // Chosen by the platform at creation time.
  // Examples: "pro", "beta-access", "partner-acme", "trial-30d"
  // VarChar(120) matches FeatureFlag.key sizing convention.
  key         String   @id @db.VarChar(120)

  // Display name for admin UI and audit logs.
  name        String

  // Optional description of what this preset enables and when to use it.
  description String?  @db.Text

  // When false: preset exists in catalog but cannot be assigned to new tenants.
  // Tenants with existing active assignments are unaffected by setting this to false —
  // their TenantFeatureFlagPreset records remain valid. This only gates new assignments.
  isActive    Boolean  @default(true)

  // The set of flag overrides this preset contributes to the resolution stack.
  // Shape (array): [{ flagKey: string, isEnabled: boolean | null, config: object | null }]
  //
  // - flagKey: must reference an existing FeatureFlag.key (validated at preset creation).
  // - isEnabled: if null, this preset does not affect the enabled state of the flag;
  //   only the config field will contribute. If set, it overrides the global isEnable
  //   for tenants assigned to this preset (still overridable by a direct TenantFeatureFlagConfig).
  // - config: if null, this preset does not affect the flag metadata.
  //   If set, REPLACES the global metadata for tenants on this preset.
  //
  // No two entries in flagOverrides may share the same flagKey (validated at save time).
  flagOverrides Json

  // Audit fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assignments TenantFeatureFlagPreset[]

  @@index([isActive])
  @@map("FeatureFlagPresets")
}
```

#### `TenantFeatureFlagPreset` — the tenant assignment

```prisma
model TenantFeatureFlagPreset {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId

  // The tenant receiving this preset assignment.
  tenantId  String    @db.ObjectId

  // References FeatureFlagPreset.key.
  // Soft reference at DB level; validated at application layer.
  // Cascade delete: if the preset catalog entry is deleted, this assignment
  // is also deleted (handled at application layer, not DB FK — MongoDB constraint).
  presetKey String    @db.VarChar(120)

  // When false: the assignment exists but contributes nothing to resolution.
  // Useful for temporarily suspending a preset without deleting the record.
  isEnabled Boolean   @default(true)

  // Optional activation window — same semantics as TenantFeatureFlagConfig.
  // - startsAt null: active immediately.
  // - endsAt null: no expiry.
  // - At exact endsAt: assignment is inactive (exclusive upper bound).
  startsAt  DateTime?
  endsAt    DateTime?

  // Audit fields
  createdBy String?   @db.ObjectId
  updatedBy String?   @db.ObjectId
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  preset FeatureFlagPreset @relation(fields: [presetKey], references: [key])

  // One active assignment per (tenant, preset) pair.
  // A tenant cannot be assigned the same preset twice simultaneously.
  // To extend a window, update the existing record.
  @@unique([tenantId, presetKey])

  // Primary lookup: all active preset assignments for a tenant.
  @@index([tenantId, isEnabled])

  // Secondary lookup: find all tenants on a given preset (impact analysis).
  @@index([presetKey])

  // Window-based lookups for expiry checks.
  @@index([endsAt])

  @@map("TenantFeatureFlagPresets")
}
```

### Resolution Algorithm (Phase 2)

Steps 1, 4, 5, 6 are identical to Phase 1. Only step 2 and 3 expand:

```
resolveFlag(flagKey, tenantId?, userId?):

  1. Load global FeatureFlag by flagKey (from cache).
     If not found → throw NotFoundException.

  2. If tenantId is present:

       a. Load TenantFeatureFlagConfig (direct override) — same as Phase 1.
          Cache key: FeatureFlag:{flagKey}:Tenant:{tenantId}

       b. If no direct override found:
            Load all active TenantFeatureFlagPreset for this tenant.
            Cache key: TenantPresets:Tenant:{tenantId}  TTL: 1h
            (Returns full list; flagKey lookup done in memory — no extra DB call per flag.)

            For each active preset:
              Check FeatureFlagPreset.flagOverrides for an entry matching flagKey.
              Cache key: Preset:{presetKey}  TTL: 1h

            Take the first matching override found.
            (Multiple active presets should not overlap on the same flagKey — see conflict
            detection below. If they do overlap due to a race condition or data inconsistency,
            the preset with the earliest createdAt wins as a deterministic fallback.)

  3. Compute effective state from whichever source matched (direct override or preset override or none):
       effectiveIsEnabled = source?.isEnabled ?? global.isEnable
       effectiveConfig    = source?.config    ?? global.metadata

  4-6. Identical to Phase 1 (enabled check, metadata key check, rollout check).
```

### Conflict Detection at Assignment Time

When assigning a preset to a tenant, the service validates that no active preset already covers any of the same `flagKey` values:

```
assignPreset(tenantId, presetKey):

  1. Validate preset exists and isActive = true.
  2. Extract flagKeys from preset.flagOverrides.
  3. Load all active TenantFeatureFlagPreset for this tenant.
  4. For each active assignment, load its FeatureFlagPreset.flagOverrides.
  5. If any flagKey in the new preset overlaps with any flagKey in an existing
     active preset → reject with ConflictException (preset.error.capabilityConflict).
  6. No overlap → create TenantFeatureFlagPreset record.
```

Note: conflict detection applies only between presets (same priority layer). A direct `TenantFeatureFlagConfig` override may silently shadow any preset value — this is intentional, not a conflict.

### Preset Mutation Rules

- **Updating `flagOverrides` on an existing preset:** Allowed. The change takes effect at the next cache expiry (max 1 hour). If an immediate effect is needed, invalidate the preset cache (`Preset:{presetKey}`) and all tenant assignment caches for tenants on that preset (`TenantPresets:Tenant:{tenantId}` for each).
- **Deleting a preset:** Only allowed if no active `TenantFeatureFlagPreset` assignments exist. Soft-delete (`isActive = false`) is preferred to preserve audit history.
- **Setting `isActive = false`:** New assignments are blocked. Existing assignments continue to resolve normally.

### Cache Strategy (Phase 2)

Extends Phase 1 cache:

| Cache Key | Content | TTL | Invalidated When |
|---|---|---|---|
| `FeatureFlag:{flagKey}` | Global FeatureFlag record | 1h | Global flag updated |
| `FeatureFlag:{flagKey}:Tenant:{tenantId}` | TenantFeatureFlagConfig record or null | 1h | Direct override upserted or deleted |
| `TenantPresets:Tenant:{tenantId}` | All active TenantFeatureFlagPreset for tenant | 1h | Any preset assigned or revoked for tenant |
| `Preset:{presetKey}` | FeatureFlagPreset record (including flagOverrides) | 1h | Preset flagOverrides or metadata updated |

The tenant preset list is loaded once per cache window. Individual flag lookups within that list are done in memory (no per-flag DB call), keeping the resolution hot path to a maximum of 3 cache reads: global flag + tenant direct override + tenant preset list.

### Admin API (Phase 2)

**Preset catalog management:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/feature-flag-presets` | List all presets (paginated) |
| `POST` | `/admin/feature-flag-presets` | Create preset |
| `PATCH` | `/admin/feature-flag-presets/:presetKey` | Update name, description, isActive |
| `PUT` | `/admin/feature-flag-presets/:presetKey/overrides` | Replace flagOverrides |

**Tenant preset assignment:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tenants/:tenantId/feature-flag-presets` | List preset assignments for tenant |
| `PUT` | `/admin/tenants/:tenantId/feature-flag-presets/:presetKey` | Assign or update preset for tenant |
| `DELETE` | `/admin/tenants/:tenantId/feature-flag-presets/:presetKey` | Revoke preset assignment |

**`POST /admin/feature-flag-presets` validation:**
1. `key` must be unique in the catalog.
2. All `flagKey` values in `flagOverrides` must reference existing `FeatureFlag.key` entries.
3. No duplicate `flagKey` within `flagOverrides` of the same preset.

**`PUT /admin/tenants/:tenantId/feature-flag-presets/:presetKey` validation:**
1. Preset must exist and `isActive = true`.
2. `startsAt < endsAt` when both present.
3. No `flagKey` overlap with other active presets for this tenant (conflict detection).

---

## Full Resolution Stack Reference

```
@FeatureFlagProtected('form.maxSubmissions')
        │
        ▼
┌─────────────────────────────────────────────┐
│  1. TenantFeatureFlagConfig                 │  Direct override?
│     tenantId + flagKey + active window      │  → use its isEnabled / config
└─────────────────────────────────────────────┘
        │ not found
        ▼
┌─────────────────────────────────────────────┐
│  2. TenantFeatureFlagPreset                 │  Active preset assignment?
│     → FeatureFlagPreset.flagOverrides       │  → use preset's isEnabled / config
│       matching flagKey                      │    for this flagKey
└─────────────────────────────────────────────┘
        │ not found
        ▼
┌─────────────────────────────────────────────┐
│  3. FeatureFlag (global default)            │  Always present (throw if missing)
│     isEnable + rolloutPercent + metadata    │  → apply rollout check here only
└─────────────────────────────────────────────┘
        │
        ▼
  effectiveIsEnabled + effectiveConfig
  → isEnabled check → metadata key check → pass or 503
```

---

## Acceptance Criteria

### Phase 1
1. `TenantFeatureFlagConfig` CRUD works with window validation and uniqueness.
2. Resolution correctly applies direct tenant override when active.
3. Resolution falls back to global flag when no active override exists.
4. Rollout check is skipped when an active tenant override is present.
5. Tenant read-only endpoint returns computed effective state only.
6. Cache is invalidated on every write to `TenantFeatureFlagConfig`.
7. `@FeatureFlagProtected` decorator and guard are unchanged.

### Phase 2
1. Preset catalog CRUD works with `flagOverrides` validation.
2. Preset assignment validates no `flagKey` conflict across active presets for a tenant.
3. Resolution correctly applies preset override when no direct override is present.
4. Direct tenant override always takes priority over preset.
5. Preset cache is invalidated on `flagOverrides` update and propagates within 1h.
6. Assigning or revoking a preset invalidates `TenantPresets:Tenant:{tenantId}` immediately.
7. `@FeatureFlagProtected` decorator and guard are still unchanged from Phase 1.

---

## Implementation Notes for Travely

1. Map `tenantId` to `agencyId` in the current domain — same ObjectId type, same JWT claim.
2. Baseline tenant limits (e.g. `form.maxSubmissions = 100`) live in the global `FeatureFlag.metadata`. Tenant-specific limits come from `TenantFeatureFlagConfig.config` or a preset's `flagOverrides[n].config`.
3. Phase 1 is sufficient to handle per-tenant trial activations, partner exceptions, and beta programs without a catalog.
4. Phase 2 becomes necessary when the same flag configuration needs to be managed as a named unit across many tenants (commercial tiers, partner packages).

## Current Limitations

1. One active direct override per `(tenantId, flagKey)` — no stacking within a layer.
2. No tenant self-serve — platform operators manage all overrides and preset assignments.
3. No per-user or per-project scoping in V1 (tenant-level only).
4. Preset conflict strategy is strict reject — no priority ordering between presets.
5. `flagOverrides` update takes up to 1h to propagate (cache TTL); no instant push.
6. No audit event log for override or assignment history.

## Future Extensions

1. Add per-user or per-project scoping as additional resolution layers above tenant.
2. Add instant cache invalidation via pub/sub (Redis keyspace events or BullMQ job).
3. Add an append-only event/history table for full audit trail of flag state changes.
4. Add preset priority ordering to allow intentional overlaps with defined precedence.
5. Add tenant self-serve assignment with entitlement/policy checks.
6. Add `TenantFeatureFlagConfig.source` field to record whether an override was set manually or generated by a system process.
