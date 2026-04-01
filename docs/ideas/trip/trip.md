# Trip Aggregate Implementation

## Scope

This file owns the aggregate-level part of the Trip domain:

1. `Trip`
2. `TripInvite`
3. `TripCalendarEvent`

Traveler grouping and traveler-document details live in [trip-traveler.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-traveler.md).

## Related Documents

1. Directory index: [README.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/README.md)
2. Traveler scope: [trip-traveler.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-traveler.md)
3. Contact scope: [trip-contact.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-contact.md)
4. Media scope: [trip-media.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-media.md)
5. Attachment scope: [trip-attachments.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-attachments.md)
6. Form scope: [trip-form.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-form.md)
7. Transport scope: [docs/ideas/transport/itinerary.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/transport/itinerary.md)

## Enumerations

```text
TripStatus: DRAFT | PUBLISHED | CANCELLED | ARCHIVED
TripInviteStatus: INVITED | ACCEPTED | REVOKED
TripEventCategory: GENERAL | ARRIVAL | DEPARTURE | CHECK_IN | CHECK_OUT |
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
8. `Trip.contacts` links to [trip-contact.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-contact.md) for traveler-facing support references.
9. `Trip.medias` links to [trip-media.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-media.md) for trip-level image/media exposure.
10. `Trip.attachments` links to [trip-attachments.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-attachments.md) for trip-specific files and legal material.
11. `Trip.forms` links to [trip-form.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-form.md) for trip-to-form assignments.
12. `TripTravelerGroup` is defined in [trip-traveler.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-traveler.md) because it also scopes travelers and traveler documents indirectly.
13. A `TripInvite` can be revoked through `status = REVOKED`, with `revokedAt` and `revokedBy` stored for audit.

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

## Behavior and Flow

### Draft Creation

1. Backend user calls `POST /shared/trips`.
2. Service creates `Trip` in `DRAFT` under the authenticated tenant.
3. Create may include connected `TripInvite`, `TripTraveler`, `TripCalendarEvent`, `TripMedia`, and `TripAttachment` payloads in the same unit of work.
4. Contact and form associations are submitted as existing `ObjectId[]` values and expanded by the service into `TripContact[]` and `TripForm[]`.

### Partial Save

1. Backend user calls `PUT /shared/trips`.
2. Payload updates the trip aggregate and its connected entities.
3. Aggregate updates may include contacts, forms, media, and attachments in the same request.
4. Contact and form associations may be replaced by resubmitting their `ObjectId[]` lists.
5. Save is idempotent by entity id and guarded by optimistic concurrency using `updatedAt`.

### Publish

1. Backend user triggers publish for an existing draft trip.
2. Service validates trip core fields, invite integrity, group references, and calendar-event chronology.
3. On success, `status = PUBLISHED` and `publishedAt` is stamped.
4. On failure, the trip remains `DRAFT` and returns deterministic validation errors.

### Invitation Acceptance

1. A `TripInvite` can exist before the invitee has an account.
2. A revoked invite is no longer valid for acceptance.
3. Accepting an invite marks the invite as `ACCEPTED`, stamps `acceptedAt`, and links `userId`.
4. The service then creates or reuses exactly one `TripTraveler` for `(tripId, userId)`.
5. The stable traveler record and traveler documents are specified in [trip-traveler.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-traveler.md).

### Status Updates

1. Backend user can cancel or archive a trip through explicit status actions.
2. Service validates allowed transitions and stamps `cancelledAt` or `archivedAt`.

## Controllers

### `trip.user.controller`

Customer-facing endpoints:

#### `GET /user/trips`

List all trips the user is part of with minimal overview information.

Suggested response shape:

1. `id`
2. `title`
3. `startDate`
4. `endDate`
5. `timezone`
6. `status`
7. light traveler/group summary when needed by the client

#### `GET /user/trips/:idTrip`

Return the complete customer-visible trip details.

This response must include:

1. trip core fields
2. accepted traveler context relevant to the user
3. `calendarEvents`
4. `calendarEvents.medias`
5. `contacts`
6. `medias`

Sensitive traveler-document fields are excluded from this endpoint and remain in [trip-traveler.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-traveler.md).

### `trip.shared.controller`

Backend-user management endpoints:

#### `POST /shared/trips`

Create a new trip and all connected entities required by the initial payload:

1. `Trip`
2. `TripInvite`
3. `TripTraveler`
4. `TripCalendarEvent`
5. `TripContact`
6. `TripMedia`
7. `TripAttachment`
8. `TripForm`

Trip contacts and trip forms are created from pre-existing ids:

1. contacts are passed as `ObjectId[]` returned by `POST /shared/contacts`
2. forms are passed as `ObjectId[]` returned by `POST /shared/forms`

Suggested linkage fields in the request body:

1. `contactIds`
2. `formIds`

#### `PUT /shared/trips`

Update an existing trip and its related entities.

If the route remains collection-based, the request body must carry the target trip id. If implementation prefers resource-style routing, this can be normalized to `PUT /shared/trips/:idTrip` without changing the domain contract.

Related collections may include:

1. invites
2. travelers
3. calendar events
4. contacts
5. medias
6. attachments
7. forms

#### `GET /shared/trips/:idTrip`

Get the management detail of one trip.

This response should load:

1. trip core
2. groups
3. invites
4. travelers
5. calendar events
6. contacts
7. medias
8. attachments
9. forms

#### `GET /shared/trips`

Paginated trip list for backend users with:

1. filters
2. light search
3. policy-scoped visibility

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

1. Partial updates are allowed in `DRAFT`.
2. Referential integrity is enforced for all explicit foreign keys.
3. Unknown child ids are rejected instead of silently recreated.
4. Contact and form associations may be submitted as lists of existing `ObjectId` values that the server expands into `TripContact[]` and `TripForm[]`.

## Authorization and Visibility

1. All `/shared/*` endpoints are authenticated and tenant-scoped.
2. Customer-facing `/user/*` trip reads only return trips the user is actually part of.
3. Cross-tenant reads and writes are always rejected.
4. Backend detail responses may include traveler summaries, but traveler-document sensitivity rules are owned by [trip-traveler.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-traveler.md).

## Concurrency

Each mutable trip write includes `ifUnmodifiedSince` based on the trip `updatedAt`.

Conflict response:

```json
{
  "code": "TRIP_EDIT_CONFLICT",
  "tripId": "...",
  "currentUpdatedAt": "2026-03-31T15:10:00.000Z"
}
```
