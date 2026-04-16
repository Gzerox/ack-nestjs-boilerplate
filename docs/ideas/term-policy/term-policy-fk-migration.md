# Future Proposal: Replace Term Policy Booleans with FK IDs

## Status

Deferred — current implementation uses boolean fields (no defaults; all values must be
explicitly set at user-creation time).

## Current Setup

The `User` model carries 4 boolean fields — no `@default` so every `user.create` call
must provide an explicit value:

```prisma
termsOfServicePolicy Boolean   // required — true at sign-up / admin-create
privacyPolicy        Boolean   // required — true at sign-up / admin-create
marketingPolicy      Boolean   // required — false unless user opted in
cookiesPolicy        Boolean   // required — false unless user opted in
```

`TERM_POLICY_USER_FIELD_MAP` (in `term-policy.constant.ts`) maps each
`EnumTermPolicyType` to its field name and is used by:

- `term-policy.repository.ts` `accept()` — sets the field to `true` on acceptance
- `term-policy.repository.ts` `publish()` — resets all matching fields to `false`
  via a bulk `updateMany` inside the publish transaction

```typescript
// accept() — sets boolean to true
{ [TERM_POLICY_USER_FIELD_MAP[type]]: true }

// publish() — bulk reset on every new version
await tx.user.updateMany({
    where: { [TERM_POLICY_USER_FIELD_MAP[type]]: true },
    data:  { [TERM_POLICY_USER_FIELD_MAP[type]]: false },
});
```

## Problem with Booleans

When a new policy version is published, every user's boolean must be reset to `false`
via a bulk `updateMany`. At scale this is a slow, write-heavy operation that runs inside
the same transaction as the publish itself.

## Proposed Design

Replace the 4 boolean fields on `User` with nullable FK UUIDs pointing to the accepted
`TermPolicy` record per type:

| Current (boolean) | Proposed (FK UUID) |
|---|---|
| `termsOfServicePolicy Boolean` | `termsOfServicePolicyId String @db.Uuid` |
| `privacyPolicy Boolean` | `privacyPolicyId String @db.Uuid` |
| `marketingPolicy Boolean` | `marketingPolicyId String? @db.Uuid` |
| `cookiesPolicy Boolean` | `cookiesPolicyId String? @db.Uuid` |

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
termPolicyTermsOfServiceId: string;   // required
termPolicyPrivacyId: string;          // required
termPolicyCookiesId?: string;         // optional
termPolicyMarketingId?: string;       // optional
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
termsOfServicePolicy Boolean
privacyPolicy        Boolean
marketingPolicy      Boolean
cookiesPolicy        Boolean

// Add:
termsOfServicePolicyId String  @db.Uuid
privacyPolicyId        String  @db.Uuid
marketingPolicyId      String? @db.Uuid
cookiesPolicyId        String? @db.Uuid

termsOfServicePolicy TermPolicy  @relation("UserTermPolicyTermsOfService", fields: [termsOfServicePolicyId], references: [id])
privacyPolicy        TermPolicy  @relation("UserTermPolicyPrivacy", fields: [privacyPolicyId], references: [id])
marketingPolicy      TermPolicy? @relation("UserTermPolicyMarketing", fields: [marketingPolicyId], references: [id])
cookiesPolicy        TermPolicy? @relation("UserTermPolicyCookies", fields: [cookiesPolicyId], references: [id])
```

### TermPolicy model — back-relations

```prisma
usersTermsOfService User[] @relation("UserTermPolicyTermsOfService")
usersPrivacy        User[] @relation("UserTermPolicyPrivacy")
usersMarketing      User[] @relation("UserTermPolicyMarketing")
usersCookies        User[] @relation("UserTermPolicyCookies")
```

## Repository Changes

**`TERM_POLICY_USER_FIELD_MAP`** (in `term-policy.constant.ts`) — update to ID field names:

```typescript
export const TERM_POLICY_USER_FIELD_MAP: Record<EnumTermPolicyType, string> = {
    [EnumTermPolicyType.termsOfService]: 'termsOfServicePolicyId',
    [EnumTermPolicyType.privacy]:        'privacyPolicyId',
    [EnumTermPolicyType.cookies]:        'cookiesPolicyId',
    [EnumTermPolicyType.marketing]:      'marketingPolicyId',
};
```

**`accept()`** — store the policy ID instead of `true`:

```typescript
// Before:
{ [TERM_POLICY_USER_FIELD_MAP[type]]: true }
// After:
{ [TERM_POLICY_USER_FIELD_MAP[type]]: termPolicyId }
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
| `user.sign-up.request.dto.ts` | Replace `cookies?/marketing?` booleans with 4 policy ID fields |
| `user.create-social.request.dto.ts` | Inherits from `UserSignUpRequestDto` — no change needed |
| `user.repository.ts` | `signUp()`/`createBySocial()` use provided IDs; `createByAdmin()`/`importByAdmin()` auto-fetch latest IDs |
| `user.dto.ts` | `@Transform` uses null-check on ID fields |
| `user.export.response.dto.ts` | `@Transform` uses null-check on ID fields |
| `migration.user.seed.ts` | Fetch latest published IDs, set FK fields on user create |
