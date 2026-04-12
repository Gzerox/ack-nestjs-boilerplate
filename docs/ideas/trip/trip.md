# Trip Aggregate Implementation

## Scope

This file owns the aggregate-level part of the Trip domain:

1. `Trip`
2. `TripCalendarEvent`

Invite workflow lives in [trip-invite.md](trip-invite.md). Traveler grouping and traveler-document details live in [trip-traveler.md](trip-traveler.md).

## Related Documents

1. Directory index: [README.md](README.md)
2. Invite scope: [trip-invite.md](trip-invite.md)
3. Traveler scope: [trip-traveler.md](trip-traveler.md)
4. Tenant contact scope: [../tenant/tenant-contact.md](../tenant/tenant-contact.md)
5. Trip contact scope: [trip-contact.md](trip-contact.md)
6. Media scope: [trip-media.md](trip-media.md)
7. Attachment scope: [trip-attachments.md](trip-attachments.md)
8. Form scope: [trip-form.md](trip-form.md)
9. Transport scope: [../transport/itinerary.md](../transport/itinerary.md)

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

- `FormModule` for trip-owned form creation, runtime form validation, and traveler assignment checks
- `CountryModule` for `TripTravelerDocument` country relations
- `NotificationModule` for invite email dispatch documented in [trip-invite.md](trip-invite.md)

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
        TripInviteUserController, // documented in trip-invite.md
    ],
})
```

Route prefixes:

- `/shared/trips` → `TripSharedController`
- `/shared/contacts` → `TripContactSharedController`
- `/shared/trips` → `TripTravelerSharedController` for `/:idTrip/travelers`
- `/user/trips` → `TripUserController`

Invite acceptance and invite revocation routes are documented in [trip-invite.md](trip-invite.md).

## Slug Generation

`Trip.slug` is auto-generated at creation time. The backend service must:

1. Normalize `trip.title` to lowercase, replace whitespace sequences with hyphens, and strip non-alphanumeric characters except hyphens.
2. Append a 6-character random suffix using `HelperService.randomString(6)`.
3. Attempt to persist with the generated slug.
4. If a unique-constraint violation occurs on `slug`, retry with a new suffix up to 3 times before throwing `InternalServerErrorException` with `EnumTripStatusCodeError.slugConflict`.

The slug is never accepted from the client payload. It is read-only after creation and exposed in GET responses for sharing or deep-linking.

## Status Code Enums

### `EnumTripStatusCodeError` (aggregate-owned values)

File: `src/modules/trip/enums/trip.status-code.enum.ts`

```typescript
export enum EnumTripStatusCodeError {
    notFound          = 5400,
    notDraft          = 5401,
    notPublished      = 5402,
    alreadyCancelled  = 5403,
    alreadyArchived   = 5404,
    alreadyPublished  = 5405,
    invalidTransition = 5406,
    publishConflict   = 5407,
    publishValidation = 5408,
    slugConflict      = 5440,
}
```

Invite-specific error codes remain documented in [trip-invite.md](trip-invite.md). Tenant contact status codes are documented in [../tenant/tenant-contact.md](../tenant/tenant-contact.md).

## i18n Key Structure

### `src/languages/en/trip.json`

Aggregate-owned keys:

```json
{
    "trip": {
        "list":        "Get trip list",
        "get":         "Get trip detail",
        "createDraft": "Trip draft created",
        "update":      "Trip updated",
        "uploadIcon":  "Trip icon uploaded",
        "uploadCoverImage": "Trip cover image uploaded",
        "publish":     "Trip published",
        "cancel":      "Trip cancelled",
        "archive":     "Trip archived"
    },
    "error": {
        "notFound":          "Trip not found",
        "notDraft":          "Trip cannot be edited after leaving draft state",
        "notPublished":      "Trip is not published",
        "alreadyCancelled":  "Trip is already cancelled",
        "alreadyArchived":   "Trip is already archived",
        "alreadyPublished":  "Trip is already published",
        "invalidTransition": "This status transition is not allowed",
        "publishConflict":   "Trip was modified by another request; reload and retry",
        "publishValidation": "Trip failed publish validation; check errors for details",
        "slugConflict":      "Could not generate a unique trip slug; try again"
    }
}
```

Invite keys are documented in [trip-invite.md](trip-invite.md). Traveler keys are documented in [trip-traveler.md](trip-traveler.md).

Response decorator usage examples:

- `@Response('trip.createDraft')` for `POST /shared/trips`
- `@Response('trip.uploadIcon')` for `PUT /shared/trips/:idTrip/icon`
- `@Response('trip.uploadCoverImage')` for `PUT /shared/trips/:idTrip/cover-image`
- `@ResponsePaging('trip.list')` for `GET /shared/trips`
- `@Response('trip.get')` for `GET /shared/trips/:idTrip`
- `@Response('tenantContact.create')` for `POST /shared/contacts`

## Enumerations

```text
TripStatus:        DRAFT | PUBLISHED | CANCELLED | ARCHIVED
TripEventCategory: GENERAL | ARRIVAL | DEPARTURE | CHECK_IN | CHECK_OUT |
                   TRANSFER | MEAL | ACTIVITY | MEETING | FREE_TIME |
                   DEADLINE | EMERGENCY | OTHER
```

## Shared Embedded File Metadata

Trip-level visuals, trip media, and attachment-backed files use the same embedded file metadata object pattern as `UserPhoto`.

```prisma
type TripFileAsset {
  bucket       String
  key          String
  cdnUrl       String?
  completedUrl String
  mime         String
  extension    String
  access       String
  size         Int
}
```

Fields:

- `bucket`: S3 bucket name
- `key`: object key/path
- `cdnUrl?`: optional CDN URL
- `completedUrl`: final resolved read URL
- `mime`: MIME type
- `extension`: file extension
- `access`: accessibility level aligned with S3 access semantics
- `size`: object size in bytes

## Prisma Draft Schema

```prisma
enum TripStatus {
  DRAFT
  PUBLISHED
  CANCELLED
  ARCHIVED
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
  icon           TripFileAsset?
  coverImage     TripFileAsset?
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
  invites        TripInvite[]        // defined in trip-invite.md
  travelers      TripTraveler[]
  calendarEvents TripCalendarEvent[]
  contacts       TripContact[]
  medias         TripMedia[]
  attachments    TripAttachment[]
  forms          Form[]

  @@index([tenantId])
  @@index([status])
  @@index([startDate])
  @@index([tenantId, status])
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
2. `TripInvite` remains a child relation of `Trip`, but its implementation contract is documented in [trip-invite.md](trip-invite.md).
3. `TripCalendarEvent` is part of the trip detail payload and must be included when loading a full trip.
4. `TripCalendarEvent.medias` exposes event-attached `TripMedia[]` when available.
5. `Trip.icon` is the compact trip visual asset intended for cards, selectors, and other reduced visual surfaces.
6. `Trip.coverImage` is the main trip banner or hero visual asset for richer read surfaces.
7. Trip-level visual assets are managed through dedicated upload endpoints after the trip exists rather than being uploaded inline with draft creation.
8. `Trip.contacts` links to [trip-contact.md](trip-contact.md), using tenant-owned contact records documented in [../tenant/tenant-contact.md](../tenant/tenant-contact.md).
9. `Trip.medias` links to [trip-media.md](trip-media.md) for trip-level image and media exposure.
10. `Trip.attachments` links to [trip-attachments.md](trip-attachments.md) for trip-specific files and legal material.
11. `Trip.forms` links to [trip-form.md](trip-form.md) for direct trip-owned forms.
12. `TripTravelerGroup` is defined in [trip-traveler.md](trip-traveler.md) because it also scopes travelers, invites, and traveler documents indirectly.
13. `createdBy` on all aggregate models stores the `userId` of the authenticated caller at creation time.

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
- `publish(tripId: string, publishedAt: Date, tx): Promise<Trip>`

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

Use `$transaction` callback syntax for aggregate writes that update the trip root and multiple child collections atomically:

```typescript
await this.databaseService.$transaction(async (tx) => {
    await this.tripRepository.update(tripId, tripData, tx);
    await this.tripCalendarEventRepository.updateMany(events, tx);
    await this.tripContactRepository.replaceAll(tripId, contactIds, tx);
});
```

Use `$transaction` array syntax for simple sequential writes to logically related rows:

```typescript
await this.databaseService.$transaction([
    this.databaseService.tripContact.deleteMany({ where: { tripId } }),
    this.databaseService.tripContact.createMany({ data: newLinks }),
]);
```

Invite-specific transaction behavior is documented in [trip-invite.md](trip-invite.md).

## Service Interfaces

### Relevant `ITripService` Methods

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

    getTripForUser(
        tripId: string,
        userId: string
    ): Promise<IResponseReturn<TripUserResponseDto>>;

    getUserTripList(
        userId: string,
        pagination: IPaginationQueryOffsetParams<Prisma.TripSelect, Prisma.TripWhereInput>
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>>;
}
```

Invite-specific `ITripService` methods remain documented in [trip-invite.md](trip-invite.md).

## DTOs

### Request DTOs

#### `TripCreateDraftRequestDto`

- `title: string` — `@IsString @IsNotEmpty`
- `subtitle?: string` — `@IsString @IsOptional`
- `description?: string` — `@IsString @IsOptional`
- `icon?: TripFileAssetDto` — `@ValidateNested @Type(() => TripFileAssetDto) @IsOptional`
- `coverImage?: TripFileAssetDto` — `@ValidateNested @Type(() => TripFileAssetDto) @IsOptional`
- `startDate: Date` — `@IsDate @Type(() => Date) @IsNotEmpty`
- `endDate: Date` — `@IsDate @Type(() => Date) @IsNotEmpty`
- `timezone?: string` — `@IsString @IsOptional` max 64 chars
- `groups?: TripGroupCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @Type(() => TripGroupCreateRequestDto) @IsOptional`
- `invites?: TripInviteCreateRequestDto[]` — invite payload contract is defined in [trip-invite.md](trip-invite.md)
- `calendarEvents?: TripCalendarEventCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @Type(() => TripCalendarEventCreateRequestDto) @IsOptional`
- `medias?: TripMediaCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @Type(() => TripMediaCreateRequestDto) @IsOptional`
- `attachments?: TripAttachmentCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @Type(() => TripAttachmentCreateRequestDto) @IsOptional`
- `contactIds?: string[]` — `@IsArray @IsMongoId({ each: true }) @IsOptional`
- `itineraries?: TripItineraryCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @Type(() => TripItineraryCreateRequestDto) @IsOptional`

Processing order note: `groups` must be materialized before `invites` and `calendarEvents` because child entities may reference `groupId` in the same payload.

#### `TripUpdateDraftRequestDto`

All fields from `TripCreateDraftRequestDto` become optional, plus:

- `updatedAt: string` — `@IsISO8601 @IsNotEmpty`

#### `TripFileAssetDto`

- `bucket: string`
- `key: string`
- `cdnUrl?: string`
- `completedUrl: string`
- `mime: string`
- `extension: string`
- `access: string`
- `size: number`

#### `TripGroupCreateRequestDto`

- `name: string` — `@IsString @IsNotEmpty`
- `colorHex?: string` — `@IsString @IsOptional` max 16 chars

#### `TripCalendarEventCreateRequestDto`

- `title: string` — `@IsString @IsNotEmpty`
- `category: TripEventCategory` — `@IsEnum(TripEventCategory) @IsNotEmpty`
- `startsAt?: Date` — `@IsDate @Type(() => Date) @IsOptional`
- `endsAt?: Date` — `@IsDate @Type(() => Date) @IsOptional`
- `location?: string` — `@IsString @IsOptional`
- `description?: string` — `@IsString @IsOptional`
- `groupId?: string` — `@IsMongoId @IsOptional`
- `medias?: TripMediaCreateRequestDto[]` — `@IsArray @ValidateNested({ each: true }) @IsOptional`

#### `TripItineraryCreateRequestDto`

- `name: string` — `@IsString @MinLength(1) @MaxLength(255)`
- `direction: EnumFlightDirection` — `@IsEnum(EnumFlightDirection)`
- `segments: TripItinerarySegmentCreateRequestDto[]` — `@IsArray @ArrayMinSize(1) @ArrayMaxSize(ItineraryMaxSegments) @ValidateNested({ each: true }) @Type(() => TripItinerarySegmentCreateRequestDto)`

#### `TripItinerarySegmentCreateRequestDto`

- `flightNumber: string` — `@IsString @MinLength(1) @MaxLength(20)`
- `airline?: string` — `@IsString @IsOptional @MaxLength(100)`
- `departAirportId: string` — `@IsMongoId @IsNotEmpty`
- `arriveAirportId: string` — `@IsMongoId @IsNotEmpty`
- `departAt?: Date` — `@Type(() => Date) @IsDate @IsOptional`
- `arriveAt?: Date` — `@Type(() => Date) @IsDate @IsOptional`
- `bookingRef?: string` — `@IsString @IsOptional @MaxLength(30)`
- `notes?: string` — `@IsString @IsOptional @MaxLength(500)`

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
- `icon: TripFileAssetDto | null`
- `coverImage: TripFileAssetDto | null`
- `startDate: Date`
- `endDate: Date`
- `timezone: string | null`
- `status: TripStatus`

#### `TripResponseDto extends DatabaseDto`

All `TripListItemResponseDto` fields plus:

- `description: string | null`
- `publishedAt: Date | null`
- `cancelledAt: Date | null`
- `archivedAt: Date | null`
- `groups: TripGroupResponseDto[]`
- `invites: TripInviteResponseDto[]` — invite response contract is defined in [trip-invite.md](trip-invite.md)
- `calendarEvents: TripCalendarEventResponseDto[]`
- `contacts: TripContactResponseDto[]`
- `medias: TripMediaResponseDto[]`
- `attachments: TripAttachmentResponseDto[]`
- `forms: FormResponseDto[]`

#### `TripUserResponseDto`

All `TripListItemResponseDto` fields plus:

- `description: string | null`
- `calendarEvents: TripCalendarEventResponseDto[]`
- `contacts: TripContactResponseDto[]`
- `medias: TripMediaResponseDto[]`
- `attachments: TripAttachmentPublicResponseDto[]`

`TripUserResponseDto` does not include `invites`, `groups`, or `forms`.

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
4. If the payload includes `groups`, they are created first.
5. Create may include connected `TripInvite`, `TripCalendarEvent`, `TripMedia`, `TripAttachment`, and `TransportItinerary` payloads in the same unit of work.
6. `icon` and `coverImage` are uploaded separately through dedicated trip asset endpoints after the draft exists.
7. Contact associations are submitted as existing `ObjectId[]` values and expanded by the service into `TripContact[]`.
8. Trip forms are created separately through `POST /shared/trips/:idTrip/forms` after the trip exists.
9. Invite creation and notification behavior during draft creation are defined in [trip-invite.md](trip-invite.md).

### Partial Save

1. Backend user calls `PUT /shared/trips/:idTrip`.
2. Request body must include `updatedAt` matching the current trip `updatedAt`.
3. Payload updates the trip aggregate and its connected entities.
4. Aggregate updates may include contacts, media, attachments, new invites, calendar events, and itineraries in the same request.
5. `icon` and `coverImage` are replaced through dedicated trip asset upload endpoints, not through the aggregate update body.
6. Contact associations may be replaced by resubmitting their `ObjectId[]` lists; the service replaces all existing links atomically.
7. Trip forms are managed through dedicated trip-form endpoints rather than aggregate update payload fields.
8. Save is idempotent by entity id where ids are supplied by the payload contract.
9. Invite additions during a partial save follow the issuance and delivery rules in [trip-invite.md](trip-invite.md).

### Publish

1. Backend user calls `PATCH /shared/trips/:idTrip/publish`.
2. Service verifies the trip belongs to the caller's tenant and is in `DRAFT` status.
3. Service runs all publish-blocking validation rules.
4. On success, `status = PUBLISHED` and `publishedAt = now()` inside a `$transaction` callback.
5. On failure, the trip remains `DRAFT` and returns deterministic validation errors with `EnumTripStatusCodeError.publishValidation`.

### Status Updates

1. Backend user can cancel or archive a trip through explicit status-transition endpoints.
2. Service validates allowed transitions and stamps `cancelledAt` or `archivedAt`.
3. Status-transition endpoints do not require an `updatedAt` concurrency token.

### Asset Uploads

1. Backend user uploads trip visuals through `PUT /shared/trips/:idTrip/icon` or `PUT /shared/trips/:idTrip/cover-image`.
2. Upload endpoints accept a single multipart file and are only allowed while the trip is in `DRAFT`.
3. Files are stored under a trip-bound S3 path derived from the persisted `tripId`.
4. Uploading a new file replaces the current field value.

## Controllers

### `TripUserController`

Path prefix: `/user/trips`

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

Response includes trip core fields, `calendarEvents` with nested `medias`, `contacts`, `medias`, and `attachments`.

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

### `TripSharedController`

Path prefix: `/shared/trips`

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

Trip contacts are created from pre-existing ids:

- contacts are passed as `contactIds: ObjectId[]` returned by `POST /shared/contacts`

Trip forms are created separately after trip creation through `POST /shared/trips/:idTrip/forms`, as documented in [trip-form.md](trip-form.md).

#### `PUT /shared/trips/:idTrip`

Update an existing draft trip and its related entities. The trip id is always taken from the URL path parameter, never from the request body.

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

#### `POST /shared/trips/:idTrip/forms`

Create a new trip-owned draft form under the trip.

See [trip-form.md](trip-form.md) for request shape, validation rules, and assignment semantics.

#### `PATCH /shared/trips/:idTrip/publish`

Transition `DRAFT -> PUBLISHED`.

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

Transition `DRAFT | PUBLISHED -> CANCELLED`.

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

Transition `PUBLISHED -> ARCHIVED`.

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

#### `GET /shared/trips/:idTrip`

Get the management detail of one trip. Response loads trip core, groups, invites, travelers, calendar events, contacts, medias, attachments, and forms.

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

- `search` matched against `title`
- `status` one or more `TripStatus` values
- `orderBy` one of `createdAt`, `startDate`, `endDate`, `title`
- `perPage`, `page`

Invite acceptance and invite revocation routes are documented in [trip-invite.md](trip-invite.md).

## Validation Rules

### Publish-blocking Rules

1. `trip.title` must be present.
2. `trip.startDate` and `trip.endDate` must be present.
3. `startDate <= endDate`.
4. At least one `TripInvite` must exist.
5. Every `TripInvite.groupId`, if set, must point to an existing `TripTravelerGroup` in the same trip.
6. Every `TripCalendarEvent.groupId`, if set, must point to an existing `TripTravelerGroup` in the same trip.
7. For events with both dates, `startsAt <= endsAt`.
8. `TripCalendarEvent.medias`, when loaded for read surfaces, must stay scoped to the same `tripId`.
9. Every attached trip-owned `Form` must already be `published`.

Invite row validation details remain documented in [trip-invite.md](trip-invite.md).

### Draft-save Rules

1. Partial updates are allowed only when `status = DRAFT`.
2. Referential integrity is enforced for all explicit foreign keys.
3. Unknown child ids are rejected instead of silently recreated.
4. Contact associations may be submitted as lists of existing `ObjectId` values that the server expands into `TripContact[]`.
5. Trip forms are created and managed through dedicated trip-form endpoints, not through `TripCreateDraftRequestDto` or `TripUpdateDraftRequestDto`.
6. Persistence failures during `createDraft` and `updateDraft` are normalized to `InternalServerErrorException` (`http.serverError.internalServerError`) and include metadata in `data`:
   - `operation`: `trip.createDraft` or `trip.updateDraft`
   - `tenantId`
   - `tripId` (generated id for create, route id for update)

## Authorization and Visibility

1. All `/shared/*` endpoints are authenticated and tenant-scoped.
2. Customer-facing `/user/*` trip reads only return trips the user is actually part of via `TripTraveler` or `TripInvite`.
3. Cross-tenant reads and writes are always rejected.
4. Backend detail responses may include traveler summaries, but traveler-document sensitivity rules are owned by [trip-traveler.md](trip-traveler.md).

## Concurrency

Optimistic concurrency is enforced via a request body field, not via the HTTP `If-Unmodified-Since` header.

Every mutable trip write that touches aggregate child data (`PUT /shared/trips/:idTrip`) must include:

```text
updatedAt: string
```

The service compares the submitted `updatedAt` against the stored `Trip.updatedAt`. If they do not match, the write is rejected:

```typescript
throw new ConflictException({
    statusCode: EnumTripStatusCodeError.publishConflict,
    message: 'trip.error.publishConflict',
    data: { currentUpdatedAt: trip.updatedAt.toISOString() },
});
```

Status-transition endpoints (`/publish`, `/cancel`, `/archive`) do not require `updatedAt` because they perform targeted state changes. Invite revocation concurrency is documented in [trip-invite.md](trip-invite.md).
