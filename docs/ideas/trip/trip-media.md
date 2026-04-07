# Trip Media Implementation

## Scope

This file owns media management for trips:

1. `TripMedia`

Trip media helps backend users upload photos or images so travelers can preview cities, points of interest, and other trip-related visuals.

## Related Documents

1. Directory index: [README.md](README.md)
2. Trip aggregate: [trip.md](trip.md)
3. Trip contact scope: [trip-contact.md](trip-contact.md)
4. Attachment scope: [trip-attachments.md](trip-attachments.md)

## Enumerations

```text
TripMediaKind: IMAGE | VIDEO | THUMBNAIL | OTHER
```
Even if we should want to support 
## Shared Embedded File Metadata

Trip media stores an embedded file metadata object using the same semantic shape as `UserPhoto`.

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

## Prisma Draft Schema

```prisma
enum TripMediaKind {
  IMAGE
  VIDEO
  THUMBNAIL
  OTHER
}

model TripMedia {
  id              String             @id @default(uuid())
  tripId          String
  calendarEventId String?
  createdBy       String

  kind            TripMediaKind      @default(OTHER)
  file            TripFileAsset
  caption         String?

  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  trip            Trip               @relation(fields: [tripId], references: [id], onDelete: Cascade)
  calendarEvent   TripCalendarEvent? @relation(fields: [calendarEventId], references: [id], onDelete: SetNull)

  @@index([tripId])
  @@index([calendarEventId])
}
```

## Entity Notes

1. `TripMedia` is trip-scoped.
2. Media can be attached to the trip directly or to a specific `TripCalendarEvent`.
3. Media is typically created during trip creation or trip editing flows.
4. No standalone controller is expected for now.
5. The `Trip` model exposes `medias TripMedia[]`.
6. The `TripCalendarEvent` model exposes `medias TripMedia[]`.
7. `TripMedia.kind` is constrained to `TripMediaKind`. Free strings are not accepted. The default value is `OTHER`.
8. `createdBy` stores the `userId` of the authenticated caller who added the media record.
9. Media persists embedded file metadata, not just a raw URL string.

## Upload and Management Behavior

1. Backend users add media as part of trip creation or update payloads.
2. Media storage and upload transport can be specified later; this file only defines the domain contract.
3. If `calendarEventId` is provided, that event must belong to the same trip as `tripId`.
4. Read surfaces should expose `completedUrl` from the embedded `file` object instead of maintaining a separate persisted URL field.

## Controllers

No dedicated controller is expected for now.

Trip-media records are managed as part of trip aggregate save flows.

## DTOs

### `TripMediaCreateRequestDto` (nested in `TripCreateDraftRequestDto` / `TripUpdateDraftRequestDto`)

- `kind: TripMediaKind` — `@IsEnum(TripMediaKind) @IsNotEmpty`
- `file: TripFileAssetDto` — `@ValidateNested @Type(() => TripFileAssetDto) @IsNotEmpty`
- `caption?: string` — `@IsString @IsOptional`
- `calendarEventId?: string` — `@IsMongoId @IsOptional` (links media to a specific calendar event within the same trip)

### `TripMediaResponseDto`

- `id: string`
- `tripId: string`
- `calendarEventId: string | null`
- `kind: TripMediaKind`
- `file: TripFileAssetDto`
- `caption: string | null`
- `createdAt: Date`
- `createdBy: string`

## End-user Surface

Trip media is returned to the traveler when invoking:

1. `GET /user/trips/:idTrip`

Expected read shape:

1. trip-level `medias`
2. event-level `calendarEvents[].medias`

## Validation Rules

1. `tripId` is always required.
2. `calendarEventId`, if set, must reference a `TripCalendarEvent` in the same trip.
3. `file` must contain valid uploaded object metadata.
4. `kind` must be a valid `TripMediaKind` value.

## Authorization and Visibility

1. Backend users manage trip media through trip aggregate write access.
2. End users only receive media from trips they are allowed to read.
3. Media visibility rules may later be extended if some media types need internal-only access.
