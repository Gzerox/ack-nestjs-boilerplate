# Trip Invite Implementation

## Scope

This file owns the invitation-specific part of the Trip domain:

1. `TripInvite`
2. invite issuance during trip draft create/update
3. invite acceptance
4. invite revocation
5. invite email delivery and token handling

Trip lifecycle and trip-facing read surfaces live in [trip.md](trip.md). Stable traveler records and traveler documents live in [trip-traveler.md](trip-traveler.md).

## Related Documents

1. Directory index: [README.md](README.md)
2. Trip aggregate scope: [trip.md](trip.md)
3. Traveler scope: [trip-traveler.md](trip-traveler.md)
4. Tenant policy scope: [../tenant/tenant-policy.md](../tenant/tenant-policy.md)
5. Trip contact scope: [trip-contact.md](trip-contact.md)

## Module & Route Ownership

`TripInvite` remains inside `TripModule`; there is no separate NestJS module for invites.

Invite-owned providers and route ownership:

- `TripInviteRepository` handles invite persistence.
- `TripService` owns invite issuance, acceptance, and revocation because invites are aggregate children of `Trip`.
- `NotificationModule` is required for invite email dispatch.
- `TripInviteUserController` owns end-user acceptance.
- `TripSharedController` owns backend invite revocation because it is a trip-scoped management action.

Router registration:

```typescript
// routes.user.module.ts
@Module({
    imports: [..., TripModule],
    controllers: [
        ...,
        TripUserController,
        TripInviteUserController,
    ],
})

// routes.shared.module.ts
@Module({
    imports: [..., TripModule],
    controllers: [
        ...,
        TripSharedController, // includes invite revoke endpoint
    ],
})
```

Route prefixes:

- `/user` → `TripInviteUserController`
- `/shared/trips` → `TripSharedController` for `/:idTrip/invites/:idInvite/revoke`

## Status Code Enums

Invite-specific values in `src/modules/trip/enums/trip.status-code.enum.ts`:

```typescript
export enum EnumTripStatusCodeError {
    inviteNotFound        = 5420,
    inviteExpired         = 5421,
    inviteRevoked         = 5422,
    inviteAlreadyAccepted = 5423,
    inviteTokenInvalid    = 5424,
    groupNotFound         = 5430,
}
```

Trip lifecycle and slug errors remain documented in [trip.md](trip.md).

## i18n Key Structure

Invite-related keys in `src/languages/en/trip.json`:

```json
{
    "invite": {
        "accept": "Invite accepted",
        "revoke": "Invite revoked"
    },
    "error": {
        "inviteNotFound":        "Invite not found",
        "inviteExpired":         "Invite has expired",
        "inviteRevoked":         "Invite has been revoked",
        "inviteAlreadyAccepted": "Invite has already been accepted",
        "inviteTokenInvalid":    "Invite token is invalid",
        "groupNotFound":         "Traveler group not found"
    }
}
```

Response decorator usage examples:

- `@Response('invite.accept')` for `POST /user/trip-invites/accept`
- `@Response('invite.revoke')` for `PATCH /shared/trips/:idTrip/invites/:idInvite/revoke`

## Enumerations

```text
TripInviteStatus: INVITED | ACCEPTED | REVOKED
```

## Prisma Draft Schema

```prisma
enum TripInviteStatus {
  INVITED
  ACCEPTED
  REVOKED
}

model TripInvite {
  id             String               @id @default(uuid())
  tripId         String
  groupId        String?
  createdBy      String

  userId         String?
  email          String               @db.VarChar(320)
  tokenHash      String               @unique

  status         TripInviteStatus     @default(INVITED)
  acceptedAt     DateTime?
  expiresAt      DateTime?
  revokedAt      DateTime?
  revokedBy      String?

  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  trip           Trip                 @relation(fields: [tripId], references: [id], onDelete: Cascade)
  group          TripTravelerGroup?   @relation(fields: [groupId], references: [id], onDelete: SetNull)

  @@unique([tripId, email])
  @@index([tripId])
  @@index([groupId])
  @@index([userId])
}
```

`Trip.invites` is defined in [trip.md](trip.md). `TripTravelerGroup.invites` is defined in [trip-traveler.md](trip-traveler.md).

## Entity Notes

1. `TripInvite` replaces the older `TripParticipant` naming in contracts and implementation.
2. `TripInvite` is the invitation workflow record and may exist before the invitee has an account.
3. `TripInvite.userId` stays nullable until a real authenticated user accepts the invite.
4. `TripInvite.tokenHash` stores only the hashed token; raw tokens are delivery-only and must never be persisted.
5. `TripInvite.groupId` is optional because some invites are ungrouped at creation time.
6. `TripInvite` handles invitation workflow only and does not own traveler documents.
7. `TripInvite.createdBy` stores the authenticated backend user who created the invite.
8. A revoked invite must keep its audit fields (`revokedAt`, `revokedBy`) even after the parent trip evolves.

## Repository

### `TripInviteRepository`

Key methods:

- `createMany(data: Prisma.TripInviteCreateManyInput[], tx?): Promise<void>`
- `findOneByIdAndTrip(inviteId: string, tripId: string): Promise<TripInvite | null>`
- `findOneByTokenHash(tokenHash: string): Promise<TripInvite | null>`
- `findManyByTrip(tripId: string): Promise<TripInvite[]>`
- `accept(inviteId: string, userId: string, acceptedAt: Date, tx): Promise<TripInvite>`
- `revoke(inviteId: string, revokedBy: string, revokedAt: Date, tx?): Promise<TripInvite>`
- `existsByTripAndEmail(tripId: string, email: string): Promise<boolean>`

Repository rules:

1. Repositories receive `DatabaseService` directly via constructor injection.
2. Repository methods do not contain business validation.
3. Multi-table invite acceptance must be executed inside a `$transaction` callback owned by the service.

## Service Ownership

`TripService` remains the concrete owner of invite behavior. Invite-specific responsibilities are:

- accept nested `TripInviteCreateRequestDto[]` payloads during `createDraft` and `updateDraft`
- generate secure invite tokens for newly created invites
- enqueue invite email notifications
- accept a pending invite from a raw token
- revoke an invite from the backend trip-management surface

Relevant `ITripService` methods:

```typescript
export interface ITripService {
    acceptInvite(
        rawToken: string,
        userId: string
    ): Promise<IResponseReturn<void>>;

    revokeInvite(
        tripId: string,
        inviteId: string,
        tenantId: string,
        revokedBy: string
    ): Promise<IResponseReturn<void>>;
}
```

Implementation notes:

1. Invite issuance during `createDraft` and `updateDraft` is part of the outer trip aggregate save.
2. Invite acceptance must create or reuse a `TripTraveler` by `(tripId, userId)` via the traveler repository.
3. Invite revocation is a targeted state change and does not require the trip-level `updatedAt` concurrency token.

## DTOs

### Request DTOs

#### `TripInviteCreateRequestDto`

- `email: string` — `@IsEmail @IsNotEmpty`
- `groupId?: string` — `@IsMongoId @IsOptional`
- `expiresAt?: Date` — `@IsDate @Type(() => Date) @IsOptional`

This DTO is nested under `TripCreateDraftRequestDto.invites` and `TripUpdateDraftRequestDto.invites` in [trip.md](trip.md).

#### `TripInviteAcceptRequestDto`

- `token: string` — `@IsString @IsNotEmpty`

### Response DTOs

#### `TripInviteResponseDto extends DatabaseDto`

- `id: string`
- `email: string`
- `groupId: string | null`
- `status: TripInviteStatus`
- `acceptedAt: Date | null`
- `expiresAt: Date | null`
- `revokedAt: Date | null`
- `revokedBy: string | null`

`tokenHash` is never exposed in any response DTO.

#### `TripResponseDto.invites`

Backend trip detail responses expose:

- `invites: TripInviteResponseDto[]`

Customer-facing `TripUserResponseDto` does not expose invite records.

## Behavior and Flow

### Invite Creation During Draft Save

Invite creation is supported inside:

- `POST /shared/trips`
- `PUT /shared/trips/:idTrip`

Behavior:

1. The backend caller submits `TripInviteCreateRequestDto[]` inside the trip aggregate payload.
2. The service normalizes `email` to a canonical lowercase value before uniqueness checks and persistence.
3. Every `groupId`, if present, must resolve to a `TripTravelerGroup` inside the same trip.
4. The service rejects duplicate invite emails in the same request payload.
5. The service rejects creation if another invite already exists for the same `(tripId, email)`.
6. For each new invite, the service generates:
   - `rawToken = HelperService.randomString(32)`
   - `tokenHash = HelperService.sha256Hash(rawToken)`
7. The database stores only `tokenHash`.
8. New invite rows are persisted inside the same trip draft transaction as the rest of the aggregate write.
9. After invite rows are persisted, the service enqueues one email notification per new invite.

Draft update rules:

1. Existing invites are historical records; they are not silently overwritten by draft updates.
2. New invites may be appended during `PUT /shared/trips/:idTrip`.
3. Invite revocation is handled explicitly through the revoke endpoint, not by omitting an invite from a later payload.

### Invitation Acceptance

Endpoint: `POST /user/trip-invites/accept`

Acceptance flow:

1. The client sends `{ token: rawToken }` in the request body.
2. The service hashes the raw token with `sha256Hash(rawToken)`.
3. The service loads `TripInvite` by `tokenHash`.
4. The service validates:
   - invite exists
   - status is `INVITED`
   - invite is not expired (`expiresAt > now()` when set)
   - invite is not revoked
5. If tenant-policy gating applies, all required policies must already be accepted as described in [../tenant/tenant-policy.md](../tenant/tenant-policy.md).
6. The service executes a `$transaction` callback:
   - update `TripInvite.status = ACCEPTED`
   - set `acceptedAt = now()`
   - set `userId = caller.userId`
   - call `TripTravelerRepository.findOrCreate(tripId, userId, invite.groupId, tx)`
7. The endpoint returns HTTP 200 with no response payload.

Acceptance invariants:

1. The token is single-use in practice because accepted invites cannot transition back to `INVITED`.
2. Re-accepting an already accepted invite returns `EnumTripStatusCodeError.inviteAlreadyAccepted`.
3. Invite acceptance must not create duplicate travelers for the same `(tripId, userId)`.

### Invite Revocation

Endpoint: `PATCH /shared/trips/:idTrip/invites/:idInvite/revoke`

Revocation flow:

1. Backend caller must be authenticated and tenant-scoped to the parent trip.
2. The service loads the invite by `inviteId` and confirms it belongs to `tripId`.
3. Valid current states are `INVITED` and `ACCEPTED`.
4. If the invite is already `REVOKED`, return a conflict-style error.
5. The service sets:
   - `status = REVOKED`
   - `revokedAt = now()`
   - `revokedBy = caller.userId`
6. The endpoint returns HTTP 200 with no response payload.

Revocation semantics:

1. Revocation closes the invite record for audit and future invite-token use.
2. Revoking an already accepted invite must not silently delete or mutate the linked `TripTraveler`; traveler access changes are a separate concern owned by [trip-traveler.md](trip-traveler.md).

### Invite Notification

When `TripInvite` rows are created, the service enqueues one email per invite:

```typescript
await notificationUtil.sendTripInvite({
    inviteId,
    email,
    rawToken,   // delivery-only, never persisted to DB
    tripTitle,
    expiresAt,
});
```

Notification rules:

1. Jobs are published to `EnumQueue.notification`.
2. The job type is `transactional`.
3. Priority is `high`.
4. The email processor renders `trip-invite.hbs` and sends through SES.
5. Invite persistence is not rolled back if queue enqueue fails; resend is an operational follow-up, not part of the original transaction.

## Controllers

### `TripInviteUserController`

Path prefix: `/user`

#### `POST /user/trip-invites/accept`

Accept a pending invite using a raw invite token.

The raw token is passed in the request body, not in the URL, to avoid token leakage through logs and intermediary infrastructure.

```typescript
@TripInviteUserAcceptDoc()
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('invite.accept')
@HttpCode(HttpStatus.OK)
@Post('/trip-invites/accept')
async accept(
    @AuthJwtPayload() { _id: userId }: IAuthJwtPayload,
    @Body() body: TripInviteAcceptRequestDto,
): Promise<IResponseReturn<void>>
```

### Invite Revocation Endpoint in `TripSharedController`

Path prefix: `/shared/trips`

#### `PATCH /shared/trips/:idTrip/invites/:idInvite/revoke`

```typescript
@TripSharedRevokeInviteDoc()
@ActivityLog(EnumActivityLogAction.adminTripRevokeInvite)
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('invite.revoke')
@HttpCode(HttpStatus.OK)
@Patch('/:idTrip/invites/:idInvite/revoke')
async revokeInvite(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
    @Param('idInvite', RequestIsValidObjectIdPipe, RequestRequiredPipe) inviteId: string,
): Promise<IResponseReturn<void>>
```

There is no standalone backend list controller for invites; invite collections are returned as part of `TripResponseDto` from [trip.md](trip.md).

## Validation Rules

1. `TripInvite.email` must be stored and compared in normalized lowercase form.
2. `@@unique([tripId, email])` enforces one invite record per email inside a trip; resend behavior should reuse the existing record instead of inserting a duplicate.
3. Duplicate emails in a single create/update payload are rejected before persistence.
4. `TripInvite.groupId`, if set, must point to an existing `TripTravelerGroup` in the same trip.
5. `TripInvite.tokenHash` must be unique globally.
6. `expiresAt`, when provided, must be later than invite creation time.
7. Accepting an invite requires `status = INVITED`.
8. `TripInvite.status = ACCEPTED` must set both `acceptedAt` and `userId`.
9. `TripInvite.status = REVOKED` must set both `revokedAt` and `revokedBy`.
10. A revoked or accepted invite cannot be returned to `INVITED`.
11. Invite acceptance must be blocked when required tenant policies are still pending.

Trip publication rules that depend on invites remain documented in [trip.md](trip.md).

## Authorization and Visibility

1. End-user acceptance requires a valid authenticated user plus a valid raw invite token.
2. Backend revocation is tenant-scoped through the parent trip and never operates cross-tenant.
3. `tokenHash` is never returned in API responses, logs, or queue payloads visible outside trusted server boundaries.
4. Backend trip detail responses may include invite summaries; customer-facing trip responses do not expose invite collections.
5. Invite records remain historical workflow artifacts even after a `TripTraveler` exists.

## Transaction Boundaries and Concurrency

1. Invite acceptance must run inside a `$transaction` callback because it updates `TripInvite` and creates or reuses `TripTraveler`.
2. Invite creation during trip draft save participates in the outer aggregate transaction described in [trip.md](trip.md).
3. Invite notification enqueue is best-effort and should happen after persistence is guaranteed.
4. `PATCH /shared/trips/:idTrip/invites/:idInvite/revoke` does not require the trip `updatedAt` optimistic concurrency token.

## Cross-document Contract

1. [trip.md](trip.md) owns trip lifecycle, aggregate draft writes, publication, and trip-facing read surfaces.
2. This file owns invite issuance, acceptance, revocation, token handling, and delivery semantics.
3. [trip-traveler.md](trip-traveler.md) owns the stable traveler record created or reused after invite acceptance.
4. [../tenant/tenant-policy.md](../tenant/tenant-policy.md) owns the policy-acceptance gate that may block invite acceptance.
