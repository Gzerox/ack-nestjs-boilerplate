# Trip Media Implementation

## Scope

This file owns media management for trips:

1. `TripMedia`

Trip media helps backend users upload photos or images so travelers can preview cities, points of interest, and other trip-related visuals.

## Related Documents

1. Directory index: [README.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/README.md)
2. Trip aggregate: [trip.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip.md)
3. Contact scope: [trip-contact.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-contact.md)
4. Attachment scope: [trip-attachments.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-attachments.md)

## Prisma Draft Schema

```prisma
model TripMedia {
  id              String             @id @default(uuid())
  tripId          String
  calendarEventId String?
  kind            String             @db.VarChar(32)
  url             String
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
5. The `Trip` model should expose `medias TripMedia[]`.
6. The `TripCalendarEvent` model exposes `medias TripMedia[]`.

## Upload and Management Behavior

1. Backend users are expected to add media as part of trip creation or update payloads.
2. Media storage and upload transport can be specified later; this file only defines the domain contract.
3. If `calendarEventId` is provided, that event must belong to the same trip as `tripId`.

## Controllers

No dedicated controller is expected for now.

Trip-media records are managed as part of trip aggregate save flows.

## End-user Surface

Trip media is returned to the traveler when invoking:

1. `GET /user/trips/:idTrip`

Expected read shape:

1. trip-level `medias`
2. event-level `calendarEvents.medias`

## Validation Rules

1. `tripId` is always required.
2. `calendarEventId`, if set, must reference a `TripCalendarEvent` in the same trip.
3. `url` must point to a valid uploaded media resource.
4. `kind` should be constrained during implementation to the supported media categories.

## Authorization and Visibility

1. Backend users manage trip media through trip aggregate write access.
2. End users only receive media from trips they are allowed to read.
3. Media visibility rules may later be extended if some media types need internal-only access.
