# Trip Traveler Implementation

## Scope

This file owns the traveler-specific part of the Trip domain:

1. `TripTravelerGroup` (renamed from `TripGroup`)
2. `TripTraveler`
3. `TripTravelerDocument`

Trip lifecycle, invites, and calendar events are defined in [trip.md](trip.md).

## Related Documents

1. Directory index: [README.md](README.md)
2. Trip aggregate: [trip.md](trip.md)
3. Trip contact scope: [trip-contact.md](trip-contact.md)
4. Media scope: [trip-media.md](trip-media.md)

## Enumerations

```text
TripTravelerDocumentType: PASSPORT | VISA | NATIONAL_ID | OTHER
```

## Prisma Draft Schema

```prisma
enum TripTravelerDocumentType {
  PASSPORT
  VISA
  NATIONAL_ID
  OTHER
}

model TripTravelerGroup {
  id             String                @id @default(uuid())
  tripId         String
  createdBy      String

  name           String
  colorHex       String?               @db.VarChar(16)

  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  trip           Trip                  @relation(fields: [tripId], references: [id], onDelete: Cascade)
  invites        TripInvite[]
  travelers      TripTraveler[]
  calendarEvents TripCalendarEvent[]

  @@unique([tripId, name])
  @@index([tripId])
}

model TripTraveler {
  id             String                 @id @default(uuid())
  tripId         String
  userId         String
  groupId        String?
  createdBy      String

  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt

  trip           Trip                   @relation(fields: [tripId], references: [id], onDelete: Cascade)
  group          TripTravelerGroup?     @relation(fields: [groupId], references: [id], onDelete: SetNull)
  documents      TripTravelerDocument[]

  @@unique([tripId, userId])
  @@index([tripId])
  @@index([userId])
  @@index([groupId])
}

model TripTravelerDocument {
  id                   String                   @id @default(uuid())
  tripTravelerId       String
  documentType         TripTravelerDocumentType
  documentNumber       String
  firstName            String
  lastName             String
  birthDate            DateTime?
  issuingCountryId     String?
  nationalityCountryId String?
  issuedAt             DateTime?
  expiresAt            DateTime?
  notes                String?                  @db.Text

  createdAt            DateTime                 @default(now())
  updatedAt            DateTime                 @updatedAt

  tripTraveler         TripTraveler             @relation(fields: [tripTravelerId], references: [id], onDelete: Cascade)
  issuingCountry       Country?                 @relation("TripTravelerDocumentIssuingCountry", fields: [issuingCountryId], references: [id], onDelete: SetNull)
  nationalityCountry   Country?                 @relation("TripTravelerDocumentNationalityCountry", fields: [nationalityCountryId], references: [id], onDelete: SetNull)

  @@index([tripTravelerId])
  @@index([issuingCountryId])
  @@index([nationalityCountryId])
  @@index([documentType])
}
```

## Entity Notes

1. `TripTravelerGroup` is the shared grouping model for invites, travelers, and calendar events.
2. `TripTraveler` is the stable per-trip access record for a real authenticated user.
3. Invite acceptance must create or reuse exactly one `TripTraveler` for `(tripId, userId)`.
4. `TripTravelerDocument` is metadata-only and must never be promoted to a global user profile document.
5. The same `TripTravelerDocument` set is reused across all traveler assignments inside one trip.
6. Missing traveler documents do not block trip publication.
7. `createdBy` on `TripTravelerGroup` and `TripTraveler` stores the `userId` of the caller who created the record.

## Service Interface

### `ITripTravelerService`

File: `src/modules/trip/interfaces/trip-traveler.service.interface.ts`

```typescript
export interface ITripTravelerService {
    getList(
        tripId: string,
        tenantId: string,
        pagination: IPaginationQueryOffsetParams<Prisma.TripTravelerSelect, Prisma.TripTravelerWhereInput>
    ): Promise<IResponsePagingReturn<TripTravelerListItemResponseDto>>;

    getOne(
        tripId: string,
        travelerId: string,
        tenantId: string
    ): Promise<IResponseReturn<TripTravelerDetailResponseDto>>;
}
```

`TripTravelerService implements ITripTravelerService` is declared as a provider inside `TripModule` and exported. There is no user-facing surface for this service.

## PII Visibility

`GET /shared/trips/:idTrip/travelers` must only expose non-sensitive document information.

Recommended non-sensitive document projection:

1. `id`
2. `documentType`
3. `issuingCountryId`
4. `nationalityCountryId`
5. `issuedAt`
6. `expiresAt`

Fields that remain sensitive and require the detail endpoint:

1. `documentNumber`
2. `firstName`
3. `lastName`
4. `birthDate`
5. `notes`

## DTOs

### Response DTOs

#### `TripTravelerListItemResponseDto extends DatabaseDto`

Non-PII projection (safe for list endpoint):

- `id: string`
- `tripId: string`
- `userId: string`
- `groupId: string | null`
- `documents: TripTravelerDocumentSummaryResponseDto[]`

#### `TripTravelerDocumentSummaryResponseDto`

Non-PII document fields only:

- `id: string`
- `documentType: TripTravelerDocumentType`
- `issuingCountryId: string | null`
- `nationalityCountryId: string | null`
- `issuedAt: Date | null`
- `expiresAt: Date | null`

#### `TripTravelerDetailResponseDto extends DatabaseDto`

Full detail including PII (only returned from detail endpoint):

- `id: string`
- `tripId: string`
- `userId: string`
- `groupId: string | null`
- `documents: TripTravelerDocumentDetailResponseDto[]`

#### `TripTravelerDocumentDetailResponseDto`

All document fields including PII:

- `id: string`
- `documentType: TripTravelerDocumentType`
- `documentNumber: string`
- `firstName: string`
- `lastName: string`
- `birthDate: Date | null`
- `issuingCountryId: string | null`
- `nationalityCountryId: string | null`
- `issuedAt: Date | null`
- `expiresAt: Date | null`
- `notes: string | null`

## Controllers

There is no customer-facing traveler controller in this scope.

### `TripTravelerSharedController`

Path prefix: `/shared/trips`

Backend users manage traveler data through the following endpoints.

#### `GET /shared/trips/:idTrip/travelers`

Load all `TripTraveler` rows for the trip, including document metadata with the non-sensitive projection only.

This endpoint is designed for operational browsing and must avoid unnecessary PII exposure.

```typescript
@TripTravelerSharedListDoc()
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@ResponsePaging('tripTraveler.list')
@Get('/:idTrip/travelers')
async list(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
    @PaginationOffsetQuery() pagination: IPaginationQueryOffsetParams,
): Promise<IResponsePagingReturn<TripTravelerListItemResponseDto>>
```

#### `GET /shared/trips/:idTrip/travelers/:idTraveler`

Load one traveler with the full document set including sensitive fields.

This endpoint has `ActivityLog` so full PII access is auditable.

```typescript
@TripTravelerSharedGetDoc()
@ActivityLog(EnumActivityLogAction.adminTripTravelerGet)
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('tripTraveler.get')
@Get('/:idTrip/travelers/:idTraveler')
async get(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
    @Param('idTraveler', RequestIsValidObjectIdPipe, RequestRequiredPipe) travelerId: string,
): Promise<IResponseReturn<TripTravelerDetailResponseDto>>
```

## Validation Rules

1. `TripTraveler.groupId`, if set, must point to an existing `TripTravelerGroup` in the same trip.
2. `TripTraveler` must stay unique by `(tripId, userId)`.
3. `TripTravelerDocument.tripTravelerId` must always belong to a traveler in the same trip being queried.
4. Document dates, when both exist, must satisfy `issuedAt <= expiresAt`.
5. Traveler document completeness is not part of trip publish validation.

## Authorization and Visibility

1. Traveler endpoints are backend-user only in this scope.
2. Reads and writes are tenant-scoped through the parent `Trip`.
3. Cross-tenant traveler and document access is always rejected.
4. Full document reads are treated as sensitive access and logged via `ActivityLog`.
5. `TripInvite` and `TripTraveler` are related but not interchangeable; the invite remains the historical invitation record.

## Cross-document Contract

1. [trip.md](trip.md) owns trip publication and invite acceptance flow.
2. This file owns the stable traveler record created after invite acceptance.
3. `TripTravelerGroup` is referenced by both files and is the shared bridge between invite, traveler, and calendar-event organization.
