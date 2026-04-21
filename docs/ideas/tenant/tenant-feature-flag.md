# Tenant Feature Flag — Implementation Spec

## Problem

The existing `FeatureFlag` system (`src/modules/feature-flag/`) is platform-wide. There is no way to enable or disable a feature for a specific tenant without affecting all users. We need per-tenant overrides that:

- Let a tenant turn a feature on or off independently of the global setting
- Inherit automatically when any user operates in that tenant's context
- Leave the global flag as a master switch (global off = nobody gets it)
- Stay simple to start, but have room for feature-specific configuration later

---

## Design Decisions

### Global flag = master switch

If the global `FeatureFlag.isEnable` is `false`, no tenant can override it to `true`. The guard checks global first and throws before ever consulting tenant overrides.

### Row-existence model

A `TenantFeatureFlag` row represents an explicit override. Deleting the row reverts the tenant to global behavior. `isEnable` is non-nullable — there is no "I have an opinion but I'm not sure" state.

### Denormalized `flagKey`

The guard runs on every guarded request. Storing `flagKey: String` directly (mirroring `FeatureFlag.key`) avoids a join and keeps the hot path to a single unique-index lookup.

### Rollout % bypassed for tenant overrides

`rolloutPercent` on global flags is for gradual canary rollouts to the general user population. A tenant override is an explicit administrative decision. Applying rollout on top would silently block a percentage of tenant users — wrong behavior. When a tenant override is active, rollout is skipped.

### Upsert over create+update

The `@@unique([tenantId, flagKey])` invariant makes upsert the natural operation. Idempotent, race-condition free, simpler API surface.

---

## Prisma Schema

Add after the `FeatureFlag` model in `prisma/schema.prisma`:

```prisma
model TenantFeatureFlag {
  id       String  @id @default(auto()) @map("_id") @db.ObjectId
  tenantId String  @db.ObjectId
  flagKey  String  // denormalized from FeatureFlag.key
  isEnable Boolean
  config   Json?   // reserved for future feature-specific configuration

  createdAt DateTime @default(now())
  createdBy String?  @db.ObjectId
  updatedAt DateTime @updatedAt
  updatedBy String?  @db.ObjectId

  @@unique(fields: [tenantId, flagKey])
  @@index(fields: [tenantId])
  @@index(fields: [flagKey])
  @@map("TenantFeatureFlags")
}
```

After schema change: `pnpm db:migrate && pnpm db:generate`

---

## Tenant Context on Request

Tenant context arrives via HTTP header: `X-Tenant-Id`.

### New middleware

`src/common/request/middlewares/request.tenant-id.middleware.ts`

```typescript
@Injectable()
export class RequestTenantIdMiddleware implements NestMiddleware {
    use(req: IRequestApp, _res: Response, next: NextFunction): void {
        const tenantId = req.headers['x-tenant-id'];
        if (tenantId && typeof tenantId === 'string' && tenantId.trim()) {
            req.__tenantId = tenantId.trim();
        }
        next();
    }
}
```

No validation of tenant existence in middleware — that stays at the business logic layer when the tenant module exists.

### IRequestApp change

`src/common/request/interfaces/request.interface.ts` — add:

```typescript
__tenantId?: string;
```

### Middleware registration

`src/common/request/request.middleware.module.ts` — add `RequestTenantIdMiddleware` after `RequestRequestIdMiddleware` in `consumer.apply(...)`.

---

## New Module: `src/modules/tenant-feature-flag/`

```
tenant-feature-flag.module.ts
    Non-global. providers + exports: service, repository, util.

constants/
    tenant-feature-flag.constant.ts     cache prefix key constant

enums/
    tenant-feature-flag.status-code.enum.ts
        notFound      = 5090
        alreadyExists = 5091

interfaces/
    tenant-feature-flag.interface.ts          ITenantFeatureFlagConfig = Record<string, unknown>
    tenant-feature-flag.service.interface.ts  ITenantFeatureFlagService (see below)

repositories/
    tenant-feature-flag.repository.ts
        findOneByTenantAndKey(tenantId, flagKey): Promise<TenantFeatureFlag | null>
        findWithPaginationOffsetByAdmin(pagination): Promise<IResponsePagingReturn<TenantFeatureFlag>>
        upsert(tenantId, flagKey, isEnable, config?, updatedBy?): Promise<TenantFeatureFlag>
        delete(tenantId, flagKey): Promise<void>

services/
    tenant-feature-flag.service.ts    implements ITenantFeatureFlagService

utils/
    tenant-feature-flag.util.ts
        getByTenantAndKeyAndCache(tenantId, flagKey): Promise<TenantFeatureFlag | null>
        deleteCacheByTenantAndKey(tenantId, flagKey): Promise<void>
        mapOne(data): TenantFeatureFlagResponseDto
        mapList(data[]): TenantFeatureFlagResponseDto[]

controllers/
    tenant-feature-flag.admin.controller.ts   (NOT in module controllers[])

dtos/
    request/tenant-feature-flag.upsert.request.dto.ts   { isEnable: boolean, config?: object }
    response/tenant-feature-flag.response.dto.ts

docs/
    tenant-feature-flag.admin.doc.ts
```

### Service Interface

```typescript
export interface ITenantFeatureFlagService {
    getListByAdmin(pagination): Promise<IResponsePagingReturn<TenantFeatureFlagResponseDto>>;
    getListByTenant(tenantId, pagination): Promise<IResponsePagingReturn<TenantFeatureFlagResponseDto>>;
    getOneByTenantAndKey(tenantId, flagKey): Promise<IResponseReturn<TenantFeatureFlagResponseDto>>;
    upsertByAdmin(tenantId, flagKey, dto, updatedBy): Promise<IResponseReturn<TenantFeatureFlagResponseDto>>;
    deleteByAdmin(tenantId, flagKey): Promise<void>;
}
```

### Cache

- Key: `TenantFeatureFlag:{tenantId}:{flagKey}`
- TTL: 1 hour (reuse `featureFlag.cacheTtlMs`)
- Invalidate on: upsert, delete

Add `tenantCachePrefixKey: 'TenantFeatureFlag'` to `IConfigFeatureFlag` in `src/configs/feature-flag.config.ts`.

---

## Guard Logic Change

**Modify** `src/modules/feature-flag/feature-flag.module.ts`:
- Import `TenantFeatureFlagModule` so `TenantFeatureFlagUtil` is available

**Modify** `src/modules/feature-flag/services/feature-flag.service.ts`:
- Inject `TenantFeatureFlagUtil` in constructor
- Extend `validateFeatureFlagGuard`:

```
Step 1 — parse keyPath → keys[]  (unchanged)

Step 2 — load global flag  (unchanged)
          if (!globalFlag || !globalFlag.isEnable) → throw 503   ← master switch

Step 3 — tenant override check  (NEW)
          if (request.__tenantId)
            override = await tenantFeatureFlagUtil.getByTenantAndKeyAndCache(tenantId, keys[0])
            if (override && !override.isEnable) → throw 503
            if (override && override.isEnable)  → skip Step 4, go to Step 5

Step 4 — rollout % check  (only when no tenant override, unchanged)

Step 5 — metadata sub-key check  (unchanged, runs when keys.length > 1)
```

---

## Admin API

Controller: `src/modules/tenant-feature-flag/controllers/tenant-feature-flag.admin.controller.ts`  
Registered in: `src/router/routes/routes.admin.module.ts`

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| `GET` | `/admin/v1/tenant-feature-flags/list` | — | All overrides (filterable by `tenantId`) |
| `GET` | `/admin/v1/tenant-feature-flags/:tenantId/list` | — | All overrides for a tenant |
| `GET` | `/admin/v1/tenant-feature-flags/:tenantId/:flagKey` | — | Single override |
| `PUT` | `/admin/v1/tenant-feature-flags/:tenantId/:flagKey` | `{ isEnable, config? }` | Create or replace override |
| `DELETE` | `/admin/v1/tenant-feature-flags/:tenantId/:flagKey` | — | Remove override (revert to global) |

Auth decorator stack (strict order per CLAUDE.md):
```
@ActivityLog(...)
@PolicyAbilityProtected({ subject: tenantFeatureFlag, action: [...] })
@RoleProtected(EnumRoleType.admin)
@UserProtected()
@AuthJwtAccessProtected()
@HttpCode(...)
@Get / @Put / @Delete
```

---

## Policy Subject

`src/modules/policy/enums/policy.enum.ts` — add:

```typescript
tenantFeatureFlag = 'tenantFeatureFlag',
```

---

## Module Wiring Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `TenantFeatureFlag` model |
| `src/common/request/interfaces/request.interface.ts` | Add `__tenantId?: string` |
| `src/common/request/middlewares/request.tenant-id.middleware.ts` | **NEW** |
| `src/common/request/request.middleware.module.ts` | Register middleware |
| `src/configs/feature-flag.config.ts` | Add `tenantCachePrefixKey` |
| `src/modules/feature-flag/feature-flag.module.ts` | Import `TenantFeatureFlagModule` |
| `src/modules/feature-flag/services/feature-flag.service.ts` | Inject util, extend guard |
| `src/modules/policy/enums/policy.enum.ts` | Add `tenantFeatureFlag` subject |
| `src/router/routes/routes.admin.module.ts` | Register controller + import module |
| `src/modules/tenant-feature-flag/**` | **NEW** (~14 files) |

---

## Future: Feature-Specific Config (`config: Json?`)

Phase 1 (this spec): `config` always `null`. DTO accepts it optionally. Service ignores it.

Phase 2: Each feature module defines its own config interface. A generic util method casts at call sites:
```typescript
// tenant-feature-flag.util.ts
async getConfigByTenantAndKey<T>(tenantId: string, flagKey: string): Promise<T | null>
```

Phase 3: Add `validateConfig(flagKey, config)` dispatcher in service — per-flag validators registered in a map, similar to `FeatureFlagUtil.checkMetadataKey` today.

No schema migration needed between phases. `config` stays nullable, existing rows unaffected.

---

## Verification

1. `pnpm db:migrate && pnpm db:generate` — `TenantFeatureFlag` in Prisma client
2. `pnpm start:dev` — app boots, `X-Tenant-Id` header populates `req.__tenantId`
3. Call `@FeatureFlagProtected('trip')` endpoint:
   - No header → global behavior (unchanged)
   - Header + no override row → global behavior  
   - Header + override `isEnable: false` → 503
   - Header + override `isEnable: true` (global on) → 200 regardless of rollout %
4. `PUT /admin/v1/tenant-feature-flags/:tenantId/trip` → creates/replaces override, cache busted
5. `DELETE /admin/v1/tenant-feature-flags/:tenantId/trip` → row gone, falls back to global
6. `pnpm test` — existing feature-flag tests still pass (guard logic is additive)
