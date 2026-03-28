---
title: Feature Flag Preset System — Implementation Spec v1
status: developing
stage: spec
feature_id: feature-flag-preset
owner: product
last_reviewed: 2026-03-28
note_type: implementation-spec
---

# Feature Flag Preset System — Implementation Spec v1

## Goal

Extend the existing global `FeatureFlag` system with a **tenant-scoped override mechanism** that supports per-tenant feature behavior without changing the guard decorator API.

This spec is split by **version**:

- **Version 1**: direct tenant overrides (delivery scope)
- **Version 2+**: named preset bundles (future extension)

## Core Idea: Layered Resolution

Resolution evaluates from most-specific to least-specific:

```
Priority 1 — Direct tenant override   (TenantFeatureFlagConfig)
Priority 2 — Global platform default  (FeatureFlag)
```

The `@FeatureFlagProtected('key')` decorator signature remains unchanged.

---

## Version 1 — Direct Tenant Override

### What it is

A per-tenant, per-flag override record. Platform operators can set `isEnabled` and/or `config` for a `(tenantId, flagKey)` pair.

### Data Model

```prisma
model TenantFeatureFlagConfig {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId

  // The tenant this override applies to.
  // Soft reference — validated at application layer.
  tenantId  String    @db.ObjectId

  // The FeatureFlag.key this override targets.
  // Soft reference — validated at application layer.
  flagKey   String

  // When null: inherit isEnable from global FeatureFlag.
  isEnabled Boolean?

  // When null: inherit metadata from global FeatureFlag.
  // When set: replaces global metadata for this tenant.
  config    Json?

  // Audit fields
  createdBy String?   @db.ObjectId
  updatedBy String?   @db.ObjectId
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  // One override per (tenant, flag).
  @@unique([tenantId, flagKey])

  // Lookup patterns
  @@index([tenantId, flagKey])
  @@index([tenantId])
  @@index([flagKey])

  @@map("TenantFeatureFlagConfigs")
}
```

### Resolution Algorithm (Version 1)

```
resolveFlag(flagKey, tenantId?, userId?):

  1. Load global FeatureFlag by flagKey (cache: FeatureFlag:{flagKey}).
     If not found → throw NotFoundException.

  2. If tenantId exists:
       Load TenantFeatureFlagConfig by (tenantId, flagKey)
       (cache: FeatureFlag:{flagKey}:Tenant:{tenantId}).

  3. Compute effective state:
       effectiveIsEnabled = override?.isEnabled ?? global.isEnable
       effectiveConfig    = override?.config    ?? global.metadata

  4. If effectiveIsEnabled = false → throw ServiceUnavailableException (503).

  5. If keyPath has metadata segment:
       Read effectiveConfig[metadataKey].
       If not boolean or not true → throw ServiceUnavailableException (503).

  6. Rollout check:
       - If a direct tenant override exists: skip rollout.
       - Else if userId present and global.rolloutPercent < 100:
           compute deterministic bucket and enforce rollout.
```

### Cache Strategy (Version 1)

Use only 2 cache keys in this version:

| Cache Key | Content | TTL | Invalidated When |
|---|---|---|---|
| `FeatureFlag:{flagKey}` | Global FeatureFlag record | 1h | Global flag updated |
| `FeatureFlag:{flagKey}:Tenant:{tenantId}` | TenantFeatureFlagConfig record (or null sentinel) | 1h | Override upserted or deleted |

### Admin API (Version 1)

All endpoints require platform operator role.

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tenants/:tenantId/feature-flags` | List all overrides for a tenant |
| `PUT` | `/admin/tenants/:tenantId/feature-flags/:flagKey` | Upsert override (create/update) |
| `DELETE` | `/admin/tenants/:tenantId/feature-flags/:flagKey` | Remove override (revert to global) |

`PUT` validation rules:
1. `flagKey` must exist in `FeatureFlag`.
2. `tenantId` must reference an existing tenant.
3. If `config` is provided, keys must be compatible with global metadata schema.

---

## Version 2+ — FeatureFlagPreset (Future)

### Scope

Introduce reusable preset bundles for assigning the same flag package to many tenants.

### Planned Additions

- `FeatureFlagPreset` catalog
- `TenantFeatureFlagPreset` assignment model
- Preset conflict/precedence rules
- Additional cache keys moved from future scope:
  - `TenantPresets:Tenant:{tenantId}`
  - `Preset:{presetKey}`

This is intentionally deferred to later versions to keep Version 1 small and predictable.

---

## Full Resolution Stack Reference

### Version 1

```
@FeatureFlagProtected('changePassword.forgotAllowed')
        │
        ▼
┌─────────────────────────────────────────────┐
│  1. TenantFeatureFlagConfig                 │  Direct override?
│     tenantId + flagKey                      │  → use isEnabled / config
└─────────────────────────────────────────────┘
        │ not found
        ▼
┌─────────────────────────────────────────────┐
│  2. FeatureFlag (global default)            │  → use isEnable / metadata / rollout
└─────────────────────────────────────────────┘
```

### Version 2

```
@FeatureFlagProtected('changePassword.forgotAllowed')
        │
        ▼
┌─────────────────────────────────────────────┐
│  1. TenantFeatureFlagConfig                 │  Direct override?
│     tenantId + flagKey                      │  → use isEnabled / config
└─────────────────────────────────────────────┘
        │ not found
        ▼
┌─────────────────────────────────────────────┐
│  2. TenantFeatureFlagPreset                 │  Active preset assignment?
│     tenantId -> presetKey(s)                │  → find override for flagKey
│     + FeatureFlagPreset.flagOverrides       │    and use isEnabled / config
└─────────────────────────────────────────────┘
        │ not found
        ▼
┌─────────────────────────────────────────────┐
│  3. FeatureFlag (global default)            │  → use isEnable / metadata / rollout
└─────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### Version 1

1. `TenantFeatureFlagConfig` CRUD works with uniqueness by `(tenantId, flagKey)`.
2. Resolution applies direct tenant override when present.
3. Resolution falls back to global flag when override is absent.
4. Rollout check is skipped when direct tenant override exists.
5. Cache invalidates on every write to `TenantFeatureFlagConfig`.
6. `@FeatureFlagProtected` decorator and guard API remain unchanged.
7. Admin endpoints exist:
   - `GET /admin/tenants/:tenantId/feature-flags`
   - `PUT /admin/tenants/:tenantId/feature-flags/:flagKey`
   - `DELETE /admin/tenants/:tenantId/feature-flags/:flagKey`

### Version 2+

1. Preset catalog and assignment are introduced without breaking Version 1 behavior.
2. Preset-specific cache keys are introduced only when preset resolution is implemented.

---

## Current Limitations

1. One active direct override per `(tenantId, flagKey)`.
2. No tenant self-serve (platform-managed only).
3. No per-user or per-project scoping in Version 1.
4. No preset bundles in Version 1.
5. No audit event history stream yet.

## Future Extensions

1. Named preset catalog with tenant assignment UI/API.
2. Per-project/per-user resolution layers above tenant.
3. Instant cache invalidation via pub/sub.
4. Append-only audit log for override and assignment history.
5. Preset precedence strategy for intentional overlap.
6. `TenantFeatureFlagConfig.source` to track manual vs automated overrides.
