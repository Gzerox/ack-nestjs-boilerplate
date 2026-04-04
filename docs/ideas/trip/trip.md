# Trip Aggregate Implementation

## Scope

This file owns the aggregate-level part of the Trip domain:

1. `Trip`
2. `TripInvite`
3. `TripCalendarEvent`

Traveler grouping and traveler-document details live in [trip-traveler.md](trip-traveler.md).

## Related Documents

1. Directory index: [README.md](README.md)
2. Traveler scope: [trip-traveler.md](trip-traveler.md)
3. Contact scope: [trip-contact.md](trip-contact.md)
4. Media scope: [trip-media.md](trip-media.md)
5. Attachment scope: [trip-attachments.md](trip-attachments.md)
6. Form scope: [trip-form.md](trip-form.md)
7. Transport scope: [docs/ideas/transport/itinerary.md](../transport/itinerary.md)

## Module & Service Layer

### TripModule

`TripModule` is the single NestJS module for the full Trip domain.

```typescript
@Module({
    imports: [FormModule, CountryModule, NotificationModule],
    providers: [
        TripService,
        TripRepository,
        TripInviteRepository,
        TripCalendarEventRepository,
        TripTravelerGroupRepository,
        TripTravelerRepository,
        TripTravelerDocumentRepository,
        TenantContactRepository,
        TripContactRepository,
        TenantContactService,
        TripTravelerService,
    ],
    exports: [TripService, TenantContactService, TripTravelerService],
    controllers: [], // Controllers registered in router layer only
})
export class TripModule {}
```

Module imports:
- `FormModule` — for form publish-status validation in `TripForm` linkage
- `CountryModule` — for `TripTravelerDocument` country relations
- `NotificationModule` — for invite email dispatch via queue

### Router Layer Registration

```typescript
// routes.shared.module.ts
@Module({
    imports: [..., TripModule],
    controllers: [
        ...,
        TripSharedController,
        TripContactSharedController,
        TripTravelerSharedController,
    ],
})

// routes.user.module.ts
@Module({
    imports: [..., TripModule],
    controllers: [
        ...,
        TripUserController,
        TripInviteUserController,
    ],
})
```

Route prefixes (from `RouterModule.register` in `router.module.ts`):
- `/shared/trips` → `TripSharedController`
- `/shared/contacts` → `TripContactSharedController`
- `/shared/trips` → `TripTravelerSharedController` (shares prefix, handles `/:idTrip/travelers` sub-routes)
- `/user/trips` → `TripUserController`
- `/user` → `TripInviteUserController` (handles `/trip-invites/accept`)

## Slug Generation

`Trip.slug` is auto-generated at creation time. The backend service must:

1. Normalise `trip.title` to lowercase, replace whitespace sequences with hyphens, strip non-alphanumeric characters except hyphens.
2. Append a 6-character random suffix using `HelperService.randomString(6)`.
3. Attempt to persist with the generated slug.
4. If a `UniqueConstraint` violation occurs on `slug`, retry with a new suffix (max 3 attempts before throwing `InternalServerErrorException` with `EnumTripStatusCodeError.slugConflict`).

The slug is **never** accepted from the client payload. It is read-only after creation and exposed in GET responses for sharing or deep-linking purposes.

## Status Code Enums

### `EnumTripStatusCodeError` (5400–5449)

File: `src/modules/trip/enums/trip.status-code.enum.ts`

```typescript
export enum EnumTripStatusCodeError {
    notFound              = 5400,
    notDraft              = 5401,
    notPublished          = 5402,
    alreadyCancelled      = 5403,
    alreadyArchived       = 5404,
    alreadyPublished      = 5405,
    invalidTransition     = 5406,
    publishConflict       = 5407, // optimistic concurrency conflict
    publishValidation     = 5408, // publish blocked by validation rules
    inviteNotFound        = 5420,
    inviteExpired         = 5421,
    inviteRevoked         = 5422,
    inviteAlreadyAccepted = 5423,
    inviteTokenInvalid    = 5424,
    groupNotFound         = 5430,
    slugConflict          = 5440,
}
```

### `EnumTenantContactStatusCodeError` (5450–5479)

File: `src/modules/trip/enums/tenant-contact.status-code.enum.ts`

```typescript
export enum EnumTenantContactStatusCodeError {
    notFound = 5450,
    deleted  = 5451,
}
```

## i18n Key Structure

### `src/languages/en/trip.json`

```json
{
    "trip": {
        "list":        "Get trip list",
        "get":         "Get trip detail",
        "createDraft": "Trip draft created",
        "update":      "Trip updated",
        "publish":     "Trip published",
        "cancel":      "Trip cancelled",
        "archive":     "Trip archived"
    },
    "invite": {
        "accept": "Invite accepted",
        "revoke": "Invite revoked"
    },
    "tripTraveler": {
        "list": "Get traveler list",
        "get":  "Get traveler detail"
    },
    "error": {
        "notFound":              "Trip not found",
        "notDraft":              "Trip cannot be edited after leaving draft state",
        "notPublished":          "Trip is not published",
        "alreadyCancelled":      "Trip is already cancelled",
        "alreadyArchived":       "Trip is already archived",
        "alreadyPublished":      "Trip is already published",
        "invalidTransition":     "This status transition is not allowed",
        "publishConflict":       "Trip was modified by another request; reload and retry",
        "publishValidation":     "Trip failed publish validation; check errors for details",
        "inviteNotFound":        "Invite not found",
        "inviteExpired":         "Invite has expired",
        "inviteRevoked":         "Invite has been revoked",
        "inviteAlreadyAccepted": "Invite has already been accepted",
        "inviteTokenInvalid":    "Invite token is invalid",
        "groupNotFound":         "Traveler group not found",
        "slugConflict":          "Could not generate a unique trip slug; try again"
    }
}
```

### `src/languages/en/tenantContact.json`

```json
{
    "tenantContact": {
        "list":   "Get contact list",
        "get":    "Get contact detail",
        "create": "Contact created",
        "update": "Contact updated",
        "delete": "Contact deleted"
    },
    "error": {
        "notFound": "Contact not found",
        "deleted":  "Contact has been deleted"
    }
}
```

Response decorator usage examples:
- `@Response('trip.createDraft')` for `POST /shared/trips`
- `@ResponsePaging('trip.list')` for `GET /shared/trips`
- `@Response('invite.accept')` for `POST /user/trip-invites/accept`
- `@Response('tenantContact.create')` for `POST /shared/contacts`

## Enumerations

```text
TripStatus:          DRAFT | PUBLISHED | CANCELLED | ARCHIVED
TripInviteStatus:    INVITED | ACCEPTED | REVOKED
TripEventCategory:   GENERAL | ARRIVAL | DEPARTURE | CHECK_IN | CHECK_OUT |
                     TRANSFER | MEAL | ACTIVITY | MEETING | FREE_TIME |
                     DEADLINE | EMERGENCY | OTHER
```

## Prisma Draft Schema

```prisma
enum TripStatus {
  DRAFT
  PUBLISHED
  CANCELLED
  ARCHIVED
}

enum TripInviteStatus {
  INVITED
  ACCEPTED
  REVOKED
}

enum TripEventCategory {
  GENERAL
  ARRIVAL
  DEPARTURE
  CHECK_IN
  CHECK_OUT
  TRANSFER
  MEAL
  ACTIVITY
  MEETING
  FREE_TIME
  DEADLINE
  EMERGENCY
  OTHER
}

model Trip {
  id             String              @id @default(uuid())
  slug           String              @unique

  tenantId       String
  createdBy      String

  title          String
  subtitle       String?
  description    String?             @db.Text
  startDate      DateTime
  endDate        DateTime
  timezone       String?             @db.VarChar(64)

  status         TripStatus          @default(DRAFT)
  publishedAt    DateTime?
  archivedAt     DateTime?
  cancelledAt    DateTime?

  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  groups         TripTravelerGroup[]
  invites        TripInvite[]
  travelers      TripTraveler[]
  calendarEvents TripCalendarEvent[]
  contacts       TripContact[]
  medias         TripMedia[]
  attachments    TripAttachment[]
  forms          TripForm[]

  @@index([tenantId])
  @@index([status])
  @@index([startDate])
  @@index([tenantId, status])
}

model TripInvite {
  id             String               @id @default(uuid())
  tripId         String
  groupId        String?
  createdBy      String

  userId         String?
  email          String               @db.VarChar(320)
  firstName      String?
  lastName       String?
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

model TripCalendarEvent {
  id             String               @id @default(uuid())
  tripId         String
  groupId        String?
  createdBy      String

  title          String
  category       TripEventCategory    @default(GENERAL)
  startsAt       DateTime?
  endsAt         DateTime?
  location       String?
  description    String?              @db.Text

  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  trip           Trip                 @relation(fields: [tripId], references: [id], onDelete: Cascade)
  group          TripTravelerGroup?   @relation(fields: [groupId], references: [id], onDelete: SetNull)
  medias         TripMedia[]

  @@index([tripId])
  @@index([groupId])
  @@index([startsAt])
}
```

## Entity Notes

1. `Trip` remains the aggregate root; all child records are scoped by `tripId`.
2. `TripInvite` replaces the old `TripParticipant` naming in contracts and implementation.
3. `TripInvite.userId` stays nullable to support pre-registration invitation flows.
4. `TripInvite.tokenHash` stores only the hashed token; raw tokens are delivery-only.
5. `TripInvite` handles invitation workflow only and does not own traveler documents.
6. `TripCalendarEvent` is part of the trip detail payload and must be included when loading a full trip.
7. `TripCalendarEvent.medias` exposes event-attached `TripMedia[]` when available.
8. `Trip.contacts` links to [trip-contact.md](trip-contact.md) for traveler-facing support references.
9. `Trip.medias` links to [trip-media.md](trip-media.md) for trip-level image/media exposure.
10. `Trip.attachments` links to [trip-attachments.md](trip-attachments.md) for trip-specific files and legal material.
11. `Trip.forms` links to [trip-form.md](trip-form.md) for trip-to-form assignments.
12. `TripTravelerGroup` is defined in [trip-traveler.md](trip-traveler.md) because it also scopes travelers and traveler documents indirectly.
13. A `TripInvite` can be revoked through `status = REVOKED`, with `revokedAt` and `revokedBy` stored for audit.
14. `createdBy` on all models stores the `userId` of the authenticated caller at creation time.

## State Model

```text
DRAFT -> PUBLISHED -> ARCHIVED
  |
  +-> CANCELLED
```

Allowed transitions:

1. `DRAFT -> PUBLISHED`
2. `DRAFT -> CANCELLED`
3. `PUBLISHED -> CANCELLED`
4. `PUBLISHED -> ARCHIVED`
5. `CANCELLED` and `ARCHIVED` are terminal

## Repositories

All repositories are `@Injectable()` classes that receive `DatabaseService` via constructor injection. No repository interface is required.

### `TripRepository`

Key methods:

- `create(data: Prisma.TripCreateInput, tx?): Promise<Trip>`
- `update(tripId: string, data: Prisma.TripUpdateInput, tx?): Promise<Trip>`
- `findOneByIdAndTenant(tripId: string, tenantId: string): Promise<Trip | null>`
- `findManyByTenant(pagination, tenantId: string, filters?): Promise<IResponsePagingReturn<Trip>>`
- `existByIdAndTenant(tripId: string, tenantId: string): Promise<{ id: string; updatedAt: Date } | null>`
- `publish(tripId: string, publishedAt: Date, tx): Promise<Trip>` — always called inside `$transaction` callback

### `TripInviteRepository`

Key methods:

- `createMany(data: Prisma.TripInviteCreateManyInput[], tx?): Promise<void>`
- `findOneByTokenHash(tokenHash: string): Promise<TripInvite | null>`
- `findManyByTrip(tripId: string): Promise<TripInvite[]>`
- `accept(inviteId: string, userId: string, acceptedAt: Date, tx): Promise<TripInvite>`
- `revoke(inviteId: string, revokedBy: string, revokedAt: Date): Promise<TripInvite>`
- `existsByTripAndEmail(tripId: string, email: string): Promise<boolean>`

### `TripCalendarEventRepository`

Key methods:

- `createMany(data: Prisma.TripCalendarEventCreateManyInput[], tx?): Promise<void>`
- `updateMany(events: Array<{ id: string; data: Prisma.TripCalendarEventUpdateInput }>, tx?): Promise<void>`
- `deleteMany(ids: string[], tx?): Promise<void>`
- `findManyByTrip(tripId: string): Promise<TripCalendarEvent[]>`

### `TripTravelerGroupRepository`

Key methods:

- `createMany(data: Prisma.TripTravelerGroupCreateManyInput[], tx?): Promise<TripTravelerGroup[]>`
- `findManyByTrip(tripId: string): Promise<TripTravelerGroup[]>`
- `existByIdAndTrip(groupId: string, tripId: string): Promise<boolean>`

### `TripContactRepository`

Key methods:

- `replaceAll(tripId: string, contactIds: string[], tx?): Promise<void>` — deletes existing links then inserts new ones
- `findManyByTrip(tripId: string): Promise<TripContact[]>`

### Transaction Conventions

Use `$transaction` **callback syntax** for operations that modify multiple unrelated tables atomically:

```typescript
// Invite acceptance — updates TripInvite + creates/reuses TripTraveler
await this.databaseService.$transaction(async (tx) => {
    await this.tripInviteRepository.accept(inviteId, userId, now, tx);
    await this.tripTravelerRepository.findOrCreate(tripId, userId, groupId, tx);
});
```

Use `$transaction` **array syntax** for simple sequential writes to logically related rows:

```typescript
// Replace TripContact links
await this.databaseService.$transaction([
    this.databaseService.tripContact.deleteMany({ where: { tripId } }),
    this.databaseService.tripContact.createMany({ data: newLinks }),
]);
```

## Service Interfaces

### `ITripService`

File: `src/modules/trip/interfaces/trip.service.interface.ts`

```typescript
export interface ITripService {
    createDraft(
        dto: TripCreateDraftRequestDto,
        tenantId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripCreateDraftResponseDto>>;

    updateDraft(
        tripId: string,
        dto: TripUpdateDraftRequestDto,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>>;

    publish(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>>;

    cancel(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<void>>;

    archive(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<void>>;

    getTrip(
        tripId: string,
        tenantId: string
    ): Promise<IResponseReturn<TripResponseDto>>;

    getTripList(
        pagination: IPaginationQueryOffsetParams<Prisma.TripSelect, Prisma.TripWhereInput>,
        tenantId: string,
        filters?: { status?: TripStatus[] }
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>>;

    // User-facing
    getTripForUser(
        tripId: string,
        userId: string
    ): Promise<IResponseReturn<TripUserResponseDto>>;

    getUserTripList(
        userId: string,
        pagination: IPaginationQueryOffsetParams<Prisma.TripSelect, Prisma.TripWhereInput>
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>>;

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

The concrete class `TripService implements ITripService`.

## DTOs

### Request DTOs

#### `TripCreateDraftRequestDto`

- `title: string` — `@IsString @IsNotEmpty`
- `subtitle?: string` — `@IsString @IsOptional`
- `description?: string` — `@IsString @IsOptional`
- `startDate: Date` — `@IsDate @Type(() => Date) @IsNotEmpty`
- `endDate: Date` — `@IsDate @Type(() => Date) @IsNotEmpty`
- `timezone?: string` — `@IsString @IsOptional` max 64 chars
- `groups?: TripGroupCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @Type(() => TripGroupCreateRequestDto) @IsOptional`
- `invites?: TripInviteCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @Type(() => TripInviteCreateRequestDto) @IsOptional`
- `calendarEvents?: TripCalendarEventCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @Type(() => TripCalendarEventCreateRequestDto) @IsOptional`
- `medias?: TripMediaCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @Type(() => TripMediaCreateRequestDto) @IsOptional`
- `attachments?: TripAttachmentCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @Type(() => TripAttachmentCreateRequestDto) @IsOptional`
- `contactIds?: string[]` — `@IsArray @IsMongoId({ each: true }) @IsOptional`
- `formIds?: string[]` — `@IsArray @IsMongoId({ each: true }) @IsOptional`

Note: `groups` must appear before `invites` and `calendarEvents` in processing order because group ids are referenced by child entities in the same payload.

#### `TripUpdateDraftRequestDto`

All fields from `TripCreateDraftRequestDto` (all optional), plus:

- `updatedAt: string` — `@IsISO8601 @IsNotEmpty` (optimistic concurrency token — the client echoes back the last known `updatedAt`)

#### `TripGroupCreateRequestDto` (nested)

- `name: string` — `@IsString @IsNotEmpty`
- `colorHex?: string` — `@IsString @IsOptional` max 16 chars

#### `TripInviteCreateRequestDto` (nested)

- `email: string` — `@IsEmail @IsNotEmpty`
- `firstName?: string` — `@IsString @IsOptional`
- `lastName?: string` — `@IsString @IsOptional`
- `groupId?: string` — `@IsMongoId @IsOptional`
- `expiresAt?: Date` — `@IsDate @Type(() => Date) @IsOptional`

#### `TripCalendarEventCreateRequestDto` (nested)

- `title: string` — `@IsString @IsNotEmpty`
- `category: TripEventCategory` — `@IsEnum(TripEventCategory) @IsNotEmpty`
- `startsAt?: Date` — `@IsDate @Type(() => Date) @IsOptional`
- `endsAt?: Date` — `@IsDate @Type(() => Date) @IsOptional`
- `location?: string` — `@IsString @IsOptional`
- `description?: string` — `@IsString @IsOptional`
- `groupId?: string` — `@IsMongoId @IsOptional`
- `medias?: TripMediaCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @IsOptional`

#### `TripInviteAcceptRequestDto`

- `token: string` — `@IsString @IsNotEmpty`

### Response DTOs

#### `TripCreateDraftResponseDto extends DatabaseDto`

- `id: string`
- `slug: string`
- `status: TripStatus`

#### `TripListItemResponseDto extends DatabaseDto`

- `id: string`
- `slug: string`
- `title: string`
- `subtitle: string | null`
- `startDate: Date`
- `endDate: Date`
- `timezone: string | null`
- `status: TripStatus`

#### `TripResponseDto extends DatabaseDto` (full backend detail)

All `TripListItemResponseDto` fields plus:

- `description: string | null`
- `publishedAt: Date | null`
- `cancelledAt: Date | null`
- `archivedAt: Date | null`
- `groups: TripGroupResponseDto[]`
- `invites: TripInviteResponseDto[]`
- `calendarEvents: TripCalendarEventResponseDto[]`
- `contacts: TripContactResponseDto[]`
- `medias: TripMediaResponseDto[]`
- `attachments: TripAttachmentResponseDto[]`
- `forms: TripFormResponseDto[]`

#### `TripUserResponseDto` (customer-facing)

All `TripListItemResponseDto` fields plus:

- `description: string | null`
- `calendarEvents: TripCalendarEventResponseDto[]` (with nested `medias`)
- `contacts: TripContactResponseDto[]`
- `medias: TripMediaResponseDto[]`
- `attachments: TripAttachmentPublicResponseDto[]`

`TripUserResponseDto` does **not** include `invites`, `groups`, or `forms`.

#### `TripInviteResponseDto extends DatabaseDto`

- `id: string`
- `email: string`
- `firstName: string | null`
- `lastName: string | null`
- `groupId: string | null`
- `status: TripInviteStatus`
- `acceptedAt: Date | null`
- `expiresAt: Date | null`
- `revokedAt: Date | null`
- `revokedBy: string | null`

`tokenHash` is **never** exposed in any response DTO.

#### `TripGroupResponseDto extends DatabaseDto`

- `id: string`
- `name: string`
- `colorHex: string | null`

#### `TripCalendarEventResponseDto extends DatabaseDto`

- `id: string`
- `title: string`
- `category: TripEventCategory`
- `startsAt: Date | null`
- `endsAt: Date | null`
- `location: string | null`
- `description: string | null`
- `groupId: string | null`
- `medias: TripMediaResponseDto[]`

### Pagination Constants

File: `src/modules/trip/constants/trip.constant.ts`

```typescript
export const TripDefaultAvailableSearch = ['title'];
export const TripDefaultAvailableSort   = ['createdAt', 'startDate', 'endDate', 'title'];
export const TripDefaultSort            = 'createdAt';
export const TripDefaultPerPage         = 20;
export const TripAvailableStatus        = Object.values(TripStatus);
```

## Behavior and Flow

### Draft Creation

1. Backend user calls `POST /shared/trips`.
2. Service generates a slug from `trip.title`.
3. Service creates `Trip` in `DRAFT` under the authenticated tenant, setting `createdBy` from JWT payload.
4. If the payload includes `groups`, they are created first (required before child entities reference `groupId`).
5. Create may include connected `TripInvite`, `TripCalendarEvent`, `TripMedia`, and `TripAttachment` payloads in the same unit of work.
6. Contact and form associations are submitted as existing `ObjectId[]` values and expanded by the service into `TripContact[]` and `TripForm[]`.
7. After persisting invites, the service enqueues one invite email notification per `TripInvite` (see [Invite Notification](#invite-notification)).

### Partial Save

1. Backend user calls `PUT /shared/trips/:idTrip`.
2. Request body must include `updatedAt` matching the current trip `updatedAt` (optimistic concurrency).
3. Payload updates the trip aggregate and its connected entities.
4. Aggregate updates may include contacts, forms, media, and attachments in the same request.
5. Contact and form associations may be replaced by resubmitting their `ObjectId[]` lists — the service replaces all existing links atomically.
6. Save is idempotent by entity id.
7. New invites added during a partial save trigger the same email notification flow.

### Publish

1. Backend user calls `PATCH /shared/trips/:idTrip/publish`.
2. Service verifies the trip belongs to the caller's tenant and is in `DRAFT` status.
3. Service runs all publish-blocking validation rules.
4. On success: `status = PUBLISHED`, `publishedAt = now()`, persisted inside a `$transaction` callback.
5. On failure, the trip remains `DRAFT` and returns deterministic validation errors with `EnumTripStatusCodeError.publishValidation`.

### Invitation Acceptance

1. User calls `POST /user/trip-invites/accept` with `{ token: rawToken }` in the request body.
2. Service hashes the token: `sha256Hash(rawToken)`.
3. Looks up `TripInvite` by `tokenHash`.
4. Validates: status must be `INVITED`, not expired (`expiresAt > now()` if set), not `REVOKED`.
5. Inside a `$transaction` callback:
   - Updates `TripInvite`: `status = ACCEPTED`, `acceptedAt = now()`, `userId = caller.userId`.
   - Calls `TripTravelerRepository.findOrCreate(tripId, userId, invite.groupId, tx)`.
6. Returns 200 with no body payload.

### Invite Notification

When `TripInvite` records are created (at trip creation or during draft edits), the service enqueues one email per invite:

```typescript
await notificationUtil.sendTripInvite({
    inviteId,
    email,
    rawToken,   // single-use — never persisted to DB, only in queue payload
    tripTitle,
    expiresAt,
});
```

The method enqueues a job to `EnumQueue.notification` with type `transactional`, priority `high`. The email processor renders a `trip-invite.hbs` template and sends via SES.

If the enqueue fails, the invite is still persisted (it can be resent manually). This matches the existing non-blocking notification pattern used in `UserService`.

Token generation (at invite creation):
1. `rawToken = HelperService.randomString(32)`
2. `tokenHash = HelperService.sha256Hash(rawToken)`
3. Store only `tokenHash` in the database.
4. Pass `rawToken` to the notification queue.

### Status Updates

1. Backend user can cancel or archive a trip through explicit status-transition endpoints.
2. Service validates allowed transitions and stamps `cancelledAt` or `archivedAt`.
3. Status-transition endpoints do **not** require an `updatedAt` concurrency token.

## Controllers

### `TripUserController`

Path prefix: `/user/trips`

Customer-facing endpoints:

#### `GET /user/trips`

List all trips the user is part of with minimal overview information.

```typescript
@TripUserListDoc()
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@ResponsePaging('trip.list')
@Get('/')
async list(
    @AuthJwtPayload() { _id: userId }: IAuthJwtPayload,
    @PaginationOffsetQuery() pagination: IPaginationQueryOffsetParams,
): Promise<IResponsePagingReturn<TripListItemResponseDto>>
```

#### `GET /user/trips/:idTrip`

Return the complete customer-visible trip details.

Response includes: trip core fields, `calendarEvents` (with nested `medias`), `contacts`, `medias`, `attachments`.

Sensitive traveler-document fields are excluded; they remain in [trip-traveler.md](trip-traveler.md).

```typescript
@TripUserGetDoc()
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('trip.get')
@Get('/:idTrip')
async get(
    @AuthJwtPayload() { _id: userId }: IAuthJwtPayload,
    @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
): Promise<IResponseReturn<TripUserResponseDto>>
```

---

### `TripInviteUserController`

Path prefix: `/user`

#### `POST /user/trip-invites/accept`

Accept a pending invite using a raw invite token.

The raw token is passed in the request **body** (not as a URL parameter) to prevent token leakage in server access logs.

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

---

### `TripSharedController`

Path prefix: `/shared/trips`

Backend-user management endpoints:

#### `POST /shared/trips`

Create a new trip and all connected entities in the initial payload.

```typescript
@TripSharedCreateDraftDoc()
@ActivityLog(EnumActivityLogAction.adminTripCreate)
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('trip.createDraft')
@HttpCode(HttpStatus.CREATED)
@Post('/')
async createDraft(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Body() body: TripCreateDraftRequestDto,
): Promise<IResponseReturn<TripCreateDraftResponseDto>>
```

Trip contacts and trip forms are created from pre-existing ids:
- contacts are passed as `contactIds: ObjectId[]` returned by `POST /shared/contacts`
- forms are passed as `formIds: ObjectId[]` returned by `POST /shared/forms`

#### `PUT /shared/trips/:idTrip`

Update an existing draft trip and its related entities. The trip id is always taken from the **URL path parameter**, never from the request body.

```typescript
@TripSharedUpdateDraftDoc()
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('trip.update')
@Put('/:idTrip')
async updateDraft(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
    @Body() body: TripUpdateDraftRequestDto,
): Promise<IResponseReturn<TripResponseDto>>
```

#### `PATCH /shared/trips/:idTrip/publish`

Transition `DRAFT → PUBLISHED`. Runs all publish-blocking validation rules before persisting.

```typescript
@TripSharedPublishDoc()
@ActivityLog(EnumActivityLogAction.adminTripPublish)
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('trip.publish')
@HttpCode(HttpStatus.OK)
@Patch('/:idTrip/publish')
async publish(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
): Promise<IResponseReturn<TripResponseDto>>
```

#### `PATCH /shared/trips/:idTrip/cancel`

Transition `DRAFT | PUBLISHED → CANCELLED`.

```typescript
@TripSharedCancelDoc()
@ActivityLog(EnumActivityLogAction.adminTripCancel)
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('trip.cancel')
@HttpCode(HttpStatus.OK)
@Patch('/:idTrip/cancel')
async cancel(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
): Promise<IResponseReturn<void>>
```

#### `PATCH /shared/trips/:idTrip/archive`

Transition `PUBLISHED → ARCHIVED`.

```typescript
@TripSharedArchiveDoc()
@ActivityLog(EnumActivityLogAction.adminTripArchive)
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('trip.archive')
@HttpCode(HttpStatus.OK)
@Patch('/:idTrip/archive')
async archive(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
): Promise<IResponseReturn<void>>
```

#### `PATCH /shared/trips/:idTrip/invites/:idInvite/revoke`

Revoke a pending or accepted invite. Valid from `INVITED` or `ACCEPTED` status; `REVOKED` returns a conflict error.

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

#### `GET /shared/trips/:idTrip`

Get the management detail of one trip. Response loads: trip core, groups, invites, travelers, calendar events, contacts, medias, attachments, forms.

```typescript
@TripSharedGetDoc()
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('trip.get')
@Get('/:idTrip')
async get(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
): Promise<IResponseReturn<TripResponseDto>>
```

#### `GET /shared/trips`

Paginated trip list for backend users with filters, light search, and policy-scoped visibility.

```typescript
@TripSharedListDoc()
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@ResponsePaging('trip.list')
@Get('/')
async list(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @PaginationOffsetQuery() pagination: IPaginationQueryOffsetParams,
    @PaginationQueryFilterEqualString('status') status?: TripStatus[],
): Promise<IResponsePagingReturn<TripListItemResponseDto>>
```

Supported query parameters:
- `search` — matched against `title`
- `status` — one or more `TripStatus` values
- `orderBy` — one of `createdAt`, `startDate`, `endDate`, `title` (default: `createdAt`)
- `perPage`, `page`

## Validation Rules

### Publish-blocking Rules

1. `trip.title` must be present.
2. `trip.startDate` and `trip.endDate` must be present.
3. `startDate <= endDate`.
4. At least one `TripInvite` must exist.
5. Every `TripInvite.groupId`, if set, must point to an existing `TripTravelerGroup` in the same trip.
6. Every `TripCalendarEvent.groupId`, if set, must point to an existing `TripTravelerGroup` in the same trip.
7. `TripInvite.tokenHash` must be unique.
8. For events with both dates, `startsAt <= endsAt`.
9. `TripCalendarEvent.medias`, when loaded for read surfaces, must stay scoped to the same `tripId`.
10. `TripInvite.status = REVOKED` must set `revokedAt` and `revokedBy`.

### Draft-save Rules

1. Partial updates are allowed only when `status = DRAFT`.
2. Referential integrity is enforced for all explicit foreign keys.
3. Unknown child ids are rejected instead of silently recreated.
4. Contact and form associations may be submitted as lists of existing `ObjectId` values that the server expands into `TripContact[]` and `TripForm[]`.

## Authorization and Visibility

1. All `/shared/*` endpoints are authenticated and tenant-scoped.
2. Customer-facing `/user/*` trip reads only return trips the user is actually part of (via `TripTraveler` or `TripInvite`).
3. Cross-tenant reads and writes are always rejected.
4. Backend detail responses may include traveler summaries, but traveler-document sensitivity rules are owned by [trip-traveler.md](trip-traveler.md).

## Concurrency

Optimistic concurrency is enforced via a request body field, **not** via the HTTP `If-Unmodified-Since` header.

Every mutable trip write that touches aggregate child data (i.e., `PUT /shared/trips/:idTrip`) must include:

```
updatedAt: string   // ISO 8601 datetime matching the trip's current updatedAt value
```

The service compares the submitted `updatedAt` string against the stored `Trip.updatedAt`. If they do not match, the write is rejected:

```typescript
throw new ConflictException({
    statusCode: EnumTripStatusCodeError.publishConflict,
    message: 'trip.error.publishConflict',
    data: { currentUpdatedAt: trip.updatedAt.toISOString() },
});
```

Status-transition endpoints (`/publish`, `/cancel`, `/archive`, `/invites/:id/revoke`) do **not** require `updatedAt` in the body since they perform targeted state changes and do not modify aggregate child data.
