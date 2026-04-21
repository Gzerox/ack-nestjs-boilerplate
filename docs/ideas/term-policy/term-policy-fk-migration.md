# Future Proposal: Replace Term Policy Booleans with FK IDs

## Status

Deferred — current implementation uses boolean fields (no defaults; all values must be
explicitly set at user-creation time).

## Current Setup

The `User` model carries 4 boolean fields — no `@default` so every `user.create` call
must provide an explicit value. Field names match `EnumTermPolicyType` values exactly,
so the type can be used as the field key directly:

```prisma
termsOfService Boolean   // required — true at sign-up / admin-create
privacy        Boolean   // required — true at sign-up / admin-create
marketing      Boolean   // required — false unless user opted in
cookies        Boolean   // required — false unless user opted in
```

The repository uses `EnumTermPolicyType` directly as the dynamic field key:

```typescript
// accept() — sets boolean to true
{ [type]: true }

// publish() — bulk reset on every new version
await tx.user.updateMany({
    where: { [type]: true },
    data:  { [type]: false },
});
```

The request DTOs (`UserSignUpRequestDto`, `UserCreateSocialRequestDto`) expose
`cookies` and `marketing` as booleans, matching the entity field names directly —
no mapping layer required.

## Problem with Booleans

When a new policy version is published, every user's boolean must be reset to `false`
via a bulk `updateMany`. At scale this is a slow, write-heavy operation that runs inside
the same transaction as the publish itself.

## Proposed Design

Replace the 4 boolean fields on `User` with nullable FK UUIDs pointing to the accepted
`TermPolicy` record per type:

| Current (boolean) | Proposed (FK UUID) |
|---|---|
| `termsOfService Boolean` | `termsOfServiceId String @db.Uuid` |
| `privacy Boolean` | `privacyId String @db.Uuid` |
| `marketing Boolean` | `marketingId String? @db.Uuid` |
| `cookies Boolean` | `cookiesId String? @db.Uuid` |

`termsOfServicePolicyId` and `privacyPolicyId` are **required** (non-nullable) — users
cannot exist without having accepted these.

## How Acceptance Guard Works

Instead of checking a boolean, compare the stored ID against the latest published ID:

```typescript
const latestId = await termPolicyRepository.findLatestPublishedId(type);
if (!latestId || user.termsOfServicePolicyId !== latestId) {
    throw new ForbiddenException({ ... });
}
```

When a new version is published, all stored IDs become stale **automatically** — no
`updateMany` needed. The first time a user hits a guarded route, they see `403` and
must re-accept via `POST /user/term-policy/accept`.

## Sign-Up Flow

The client sends the IDs of the policies shown to the user. The server validates each
ID is the latest published version before creating the user:

```typescript
// DTO
termsOfServiceId: string;   // required
privacyId: string;          // required
cookiesId?: string;         // optional
marketingId?: string;       // optional
```

```typescript
// Service — validate before creating
await termPolicyService.validateIsLatestPublished(
    termPolicyTermsOfServiceId,
    EnumTermPolicyType.termsOfService
);
```

## Admin/Import Flow

Admin-created users are auto-assigned the latest published policy IDs for
`termsOfService` and `privacy` (server-side lookup), since they have no UI to present
policies:

```typescript
const tosId = await termPolicyRepository.findLatestPublishedId(
    EnumTermPolicyType.termsOfService
);
const privacyId = await termPolicyRepository.findLatestPublishedId(
    EnumTermPolicyType.privacy
);
```

## Schema Changes

### User model

```prisma
// Remove:
termsOfService Boolean
privacy        Boolean
marketing      Boolean
cookies        Boolean

// Add:
termsOfServiceId String  @db.Uuid
privacyId        String  @db.Uuid
marketingId      String? @db.Uuid
cookiesId        String? @db.Uuid

termsOfService TermPolicy  @relation("UserTermPolicyTermsOfService", fields: [termsOfServiceId], references: [id])
privacy        TermPolicy  @relation("UserTermPolicyPrivacy", fields: [privacyId], references: [id])
marketing      TermPolicy? @relation("UserTermPolicyMarketing", fields: [marketingId], references: [id])
cookies        TermPolicy? @relation("UserTermPolicyCookies", fields: [cookiesId], references: [id])
```

### TermPolicy model — back-relations

```prisma
usersTermsOfService User[] @relation("UserTermPolicyTermsOfService")
usersPrivacy        User[] @relation("UserTermPolicyPrivacy")
usersMarketing      User[] @relation("UserTermPolicyMarketing")
usersCookies        User[] @relation("UserTermPolicyCookies")
```

## Repository Changes

**`accept()`** — store the policy ID instead of `true`:

```typescript
// Before:
{ [type]: true }
// After:
{ [type]: termPolicyId }
```

**`publish()`** — remove the `updateMany` block entirely. Users' stored IDs become
stale implicitly.

**Add `findLatestPublishedId(type)`:**

```typescript
async findLatestPublishedId(type: EnumTermPolicyType): Promise<string | null> {
    const policy = await this.databaseService.termPolicy.findFirst({
        where: { type, status: EnumTermPolicyStatus.published },
        orderBy: { version: Prisma.SortOrder.desc },
        select: { id: true },
    });
    return policy?.id ?? null;
}
```

## Caching Consideration

`findLatestPublishedId` is called on every guarded request. At scale, cache this result
in Redis at the **service layer** (not repository layer) with a 1-hour TTL, busted on
`publish`:

```typescript
// In TermPolicyService
const cacheKey = `termPolicy:latest:${type}`;
const cached = await this.cacheManager.get<string>(cacheKey);
if (cached) return cached;
const id = await this.termPolicyRepository.findLatestPublishedId(type);
if (id) await this.cacheManager.set(cacheKey, id, 3_600_000);
return id;
```

## Files to Change

| File | Change |
|---|---|
| `prisma/schema.prisma` | Replace 4 booleans with 4 FK UUID fields + relations on `User`; add back-relations on `TermPolicy` |
| `term-policy.repository.ts` | Update field map; `accept()` stores ID; `publish()` removes `updateMany`; add `findLatestPublishedId()` |
| `term-policy.service.ts` | `validateTermPolicyGuard()` compares IDs; add `validateIsLatestPublished()`; optionally add caching |
| `user.service.ts` | Inject `TermPolicyService`; call `validateIsLatestPublished()` in `signUp()` and `loginWithSocial()` |
| `user.sign-up.request.dto.ts` | Replace `cookies`/`marketing` booleans with 4 policy ID fields |
| `user.create-social.request.dto.ts` | Inherits from `UserSignUpRequestDto` — no change needed |
| `user.repository.ts` | `signUp()`/`createBySocial()` use provided IDs; `createByAdmin()`/`importByAdmin()` auto-fetch latest IDs |
| `user.dto.ts` | `@Transform` uses null-check on ID fields |
| `user.export.response.dto.ts` | `@Transform` uses null-check on ID fields |
| `migration.user.seed.ts` | Fetch latest published IDs, set FK fields on user create |
