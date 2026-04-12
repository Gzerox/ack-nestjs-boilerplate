# Trip Documentation

This document describes the current Trip implementation in `src/modules/trip`, including invite, media, and attachment behavior.

## Overview

The Trip module handles:

- trip draft creation and updates
- trip lifecycle transitions (`draft`, `published`, `cancelled`, `archived`)
- invite issuance, acceptance, and revocation
- traveler read endpoints for shared backoffice users
- trip media and attachment management (JSON payload and multipart upload flows)
- trip-facing read APIs for shared and end-user surfaces

This file is the consolidated source for the old trip split docs (`trip-invite.md`, `trip-media.md`, `trip-attachments.md`, and `README.md`).

## Related Documents

- [Authentication](../../authentication.md)
- [Authorization](../../authorization.md)
- [File Upload](../../file-upload.md)
- [Trip Traveler](trip-traveler.md)
- [Trip Contact](trip-contact.md)
- [Trip Form](trip-form.md)
- [Transport Itinerary](../transport/itinerary.md)

## Table of Contents

- [Domain Models](#domain-models)
- [Module and Routing](#module-and-routing)
- [Endpoint Matrix](#endpoint-matrix)
- [Auth and Activity Matrix](#auth-and-activity-matrix)
- [Main DTO Contracts](#main-dto-contracts)
- [Validation and Limits](#validation-and-limits)
- [Trip Lifecycle and Draft Behavior](#trip-lifecycle-and-draft-behavior)
- [Invite Behavior](#invite-behavior)
- [Media Behavior](#media-behavior)
- [Attachment Behavior](#attachment-behavior)
- [Request and Response Examples](#request-and-response-examples)
- [Status Transition Matrix](#status-transition-matrix)
- [Read Surfaces](#read-surfaces)
- [Data Visibility Rules](#data-visibility-rules)
- [Failure and Recovery Semantics](#failure-and-recovery-semantics)
- [Error Codes and Messages](#error-codes-and-messages)
- [Current Implementation Gaps](#current-implementation-gaps)

## Domain Models

Trip domain data in Prisma (`prisma/schema.prisma`):

- `Trip`
- `TripCalendarEvent`
- `TripInvite`
- `TripTraveler`
- `TripContact`
- `TripAsset`
- `TripMedia`
- `TripAttachment`

Key enums:

- `TripStatus`: `draft`, `published`, `cancelled`, `archived`
- `TripInviteStatus`: `invited`, `accepted`, `revoked`
- `TripEventCategory`: `general`, `arrival`, `departure`, `checkIn`, `checkOut`, `transfer`, `meal`, `activity`, `meeting`, `freeTime`, `deadline`, `emergency`, `other`
- `TripMediaKind`: `IMAGE`, `VIDEO`, `THUMBNAIL`, `OTHER`
- `TripAttachmentType`: `TERMS_AND_CONDITIONS`, `PRIVACY_POLICY`, `INSURANCE`, `VISA_REQUIREMENTS`, `HEALTH_REQUIREMENTS`, `OTHER`

Asset storage split:

- `Trip.icon` and `Trip.coverImage` use Prisma composite type `TripFileAsset`
- `TripMedia` and `TripAttachment` files use `TripAsset` relation via `assetId`

## Module and Routing

### Module

`TripModule` (`src/modules/trip/trip.module.ts`) imports:

- `AwsModule`
- `TransportModule`

Main providers:

- `TripService`
- `TripTravelerService`
- `TripRepository`
- `TripInviteRepository`
- `TripAssetRepository`
- `TripCalendarEventRepository`
- `TripTravelerRepository`
- `TenantContactRepository`
- `TripUtil`

### Router ownership

Controllers are registered in router modules (feature module has `controllers: []`):

- `RoutesSharedModule` registers `TripSharedController`
- `RoutesUserModule` registers `TripUserController`

### Route map

Paths below are controller-level paths and are additionally prefixed by app global prefix and URI versioning.

Shared (`TripSharedController`, controller path `/trips`):

- `POST /trips` create draft
- `PUT /trips/:idTrip` update draft
- `PUT /trips/:idTrip/icon` upload icon
- `PUT /trips/:idTrip/cover-image` upload cover image
- `PATCH /trips/:idTrip/publish`
- `PATCH /trips/:idTrip/unpublish`
- `PATCH /trips/:idTrip/cancel`
- `PATCH /trips/:idTrip/archive`
- `GET /trips/:idTrip`
- `GET /trips`
- `PATCH /trips/:idTrip/invites/:idInvite/revoke`
- `GET /trips/:idTrip/travelers`
- `GET /trips/:idTrip/travelers/:idTraveler`
- `POST /trips/:idTrip/media` multipart media upload
- `POST /trips/:idTrip/attachments` multipart attachment upload

User (`TripUserController`, controller path `/user/trips`):

- `GET /user/trips/invites`
- `POST /user/trips/invites/accept`
- `GET /user/trips`
- `GET /user/trips/:idTrip`

Security decorators on both controllers:

- `@UserProtected()`
- `@AuthJwtAccessProtected()`
- `@FeatureFlagProtected('trip')`
- `@ApiKeyProtected()`

## Endpoint Matrix

All paths below are controller-declared paths. Router-module mount prefix, app global prefix, and URI versioning are applied outside this table.

| Scope | Method | Path | Main purpose |
|---|---|---|---|
| shared | `POST` | `/trips` | create trip draft |
| shared | `PUT` | `/trips/:idTrip` | update existing draft |
| shared | `PUT` | `/trips/:idTrip/icon` | upload icon asset |
| shared | `PUT` | `/trips/:idTrip/cover-image` | upload cover image asset |
| shared | `PATCH` | `/trips/:idTrip/publish` | set trip to `published` |
| shared | `PATCH` | `/trips/:idTrip/unpublish` | set trip back to `draft` |
| shared | `PATCH` | `/trips/:idTrip/cancel` | cancel trip |
| shared | `PATCH` | `/trips/:idTrip/archive` | archive trip |
| shared | `GET` | `/trips` | list trips |
| shared | `GET` | `/trips/:idTrip` | trip detail |
| shared | `PATCH` | `/trips/:idTrip/invites/:idInvite/revoke` | revoke invite |
| shared | `GET` | `/trips/:idTrip/travelers` | list travelers |
| shared | `GET` | `/trips/:idTrip/travelers/:idTraveler` | traveler detail |
| shared | `POST` | `/trips/:idTrip/media` | multipart media batch upload |
| shared | `POST` | `/trips/:idTrip/attachments` | multipart attachment batch upload |
| user | `GET` | `/user/trips/invites` | list invites for current user/email |
| user | `POST` | `/user/trips/invites/accept` | accept invite token |
| user | `GET` | `/user/trips` | list available trips |
| user | `GET` | `/user/trips/:idTrip` | read one published trip if user is traveler |

## Auth and Activity Matrix

### Common guards

All endpoints in `TripSharedController` and `TripUserController` currently require:

- `@UserProtected()`
- `@AuthJwtAccessProtected()`
- `@FeatureFlagProtected('trip')`
- `@ApiKeyProtected()`

### Activity-log coverage

| Endpoint | ActivityLog action |
|---|---|
| `POST /trips` | `adminTripCreate` |
| `PATCH /trips/:idTrip/publish` | `adminTripPublish` |
| `PATCH /trips/:idTrip/unpublish` | `adminTripPublish` |
| `PATCH /trips/:idTrip/cancel` | `adminTripCancel` |
| `PATCH /trips/:idTrip/archive` | `adminTripArchive` |
| `PATCH /trips/:idTrip/invites/:idInvite/revoke` | `adminTripRevokeInvite` |
| `GET /trips/:idTrip/travelers/:idTraveler` | `adminTripTravelerGet` |

## Main DTO Contracts

Trip draft create (`TripCreateDraftRequestDto`):

- required: `title`, `startDate`, `endDate`
- optional: `subtitle`, `description`, `icon`, `coverImage`, `timezone`, `calendarEvents`, `invites`, `medias`, `attachments`, `contactIds`, `itineraries`

Trip draft update (`TripUpdateDraftRequestDto`):

- required: `updatedAt` (ISO string optimistic-concurrency token)
- optional partial updates for all fields from draft base DTO

Invite DTOs:

- `TripInviteCreateRequestDto`: `email` (normalized to lower-case), optional `expiresAt`
- `TripInviteAcceptRequestDto`: `token`

Media DTOs:

- JSON nested create (`TripMediaCreateRequestDto`): `kind`, `file`, optional `caption`, optional `calendarEventId`
- multipart metadata (`TripMediaBatchItemRequestDto`): `kind`, optional `caption`, optional `calendarEventId`

Attachment DTOs:

- JSON nested create (`TripAttachmentCreateRequestDto`): `title`, `type`, `required`, plus either `contentMarkdown` or `file`
- multipart metadata (`TripAttachmentBatchItemRequestDto`): `title`, `type`, optional `displayName`

## Validation and Limits

Core request constraints:

- all trip/id params use `RequestIsValidObjectIdPipe` + `RequestRequiredPipe`
- draft update requires `updatedAt` ISO timestamp and strict equality against persisted `updatedAt`
- invite create normalizes `email` to lower-case and trims whitespace
- invite accept requires non-empty `token`
- media batch and attachment batch require `files.length === metadata.length`

File and upload constraints:

- default max file size is `FileSizeInBytes` (`10mb`)
- icon/cover upload allowed extensions: `jpeg`, `jpg`, `png`
- media batch allowed extensions: `jpeg`, `jpg`, `png`, `mp4`; max files `20`
- attachment batch allowed extension: `pdf`; max files `10`

Domain-level constraints:

- media metadata `calendarEventId`, when provided, must belong to the same trip
- attachment create DTO enforces content source via validators (`contentMarkdown` or `file`)
- invite uniqueness is enforced in DB by unique `(tripId, email)` and in update flow by service pre-check

## Trip Lifecycle and Draft Behavior

### Draft create

`TripService.createDraft`:

- validates `contactIds` against active tenant contacts
- generates slug through `TripUtil.generateUniqueSlug` (normalized title + 6-char suffix, max 3 attempts)
- creates trip as `status: draft`
- optionally creates nested:
  - `calendarEvents`
  - `invites`
  - `medias`
  - `attachments`
  - `contacts`
  - `itineraries`

Return payload: `TripCreateDraftResponseDto` (`id`, `slug`, `status`).

### Draft update

`TripService.updateDraft` rules:

- trip must exist for tenant
- `updatedAt` must match persisted `updatedAt` exactly
- trip must still be `draft`
- if `contactIds` provided, all must be active tenant contacts
- if `invites` provided, new invite emails are validated against duplicates in the request and existing trip invites

Update behavior for array fields is replace-all when field is provided:

- `itineraries`, `calendarEvents`, `medias`, `attachments`, `contacts`
- implementation currently does `deleteMany` then `create`

After updates where `medias` or `attachments` are provided, orphan `TripAsset` rows are removed by `TripAssetRepository.deleteOrphanByTrip`.

### Status transitions

`publish`:

- allowed only from `draft`
- rejects already `published` explicitly
- sets `status=published` and `publishedAt`

`unpublish`:

- allowed only from `published`
- sets `status=draft` and clears `publishedAt`

`cancel`:

- rejects when already `cancelled` or `archived`
- sets `status=cancelled` and `cancelledAt`

`archive`:

- allowed only from `published`
- rejects already `archived`
- sets `status=archived` and `archivedAt`

## Invite Behavior

Invite storage and list surface:

- `TripInvite` has unique `tokenHash` and unique `(tripId, email)`
- list endpoint (`getUserInviteList`) returns invites where `userId` matches JWT user OR `email` matches JWT email

Invite issuance behavior:

- create draft: invite records are created with hashed random token
- update draft: new invite records are appended (existing rows are not replaced)
- emails are normalized by DTO transform

Invite accept behavior (`acceptInvite`):

- hashes provided raw token and loads by `tokenHash`
- rejects missing token (`inviteTokenInvalid`)
- rejects already accepted/revoked/expired
- transactionally:
  - marks invite as accepted
  - creates `TripTraveler` if `(tripId, userId)` does not already exist

Invite revoke behavior (`revokeInvite`):

- verifies trip exists for tenant
- verifies invite belongs to trip
- rejects already revoked
- sets `status=revoked`, `revokedAt`, `revokedBy`

## Media Behavior

Media can be created in two ways.

### 1. JSON nested in draft payload

Used in create/update draft payloads via `TripMediaCreateRequestDto` with full file metadata (`TripFileAssetRequestDto`).

### 2. Multipart batch upload

`POST /trips/:idTrip/media`:

- expects multipart `files[]` (max 20)
- allowed extensions: `jpeg`, `jpg`, `png`, `mp4`
- expects `data` form field as JSON array matching files count
- validates trip exists and is `draft`
- validates any provided `calendarEventId` belongs to same trip
- uploads files to S3, creates `TripAsset` + `TripMedia` in DB transaction
- on failure, best-effort cleanup of uploaded S3 objects

Response uses `TripMediaResponseDto` where `file` is mapped from joined `TripAsset`.

## Attachment Behavior

Attachments can be created in two ways.

### 1. JSON nested in draft payload

Used in create/update draft payloads via `TripAttachmentCreateRequestDto`:

- requires `title`, `type`, `required`
- enforces one content source:
  - `contentMarkdown`, or
  - `file` metadata

### 2. Multipart batch upload

`POST /trips/:idTrip/attachments`:

- expects multipart `files[]` (max 10)
- allowed extension: `pdf`
- expects `data` form field as JSON array matching files count
- validates trip exists and is `draft`
- uploads files to S3, creates `TripAsset` + `TripAttachment`
- attachment rows created by batch flow always set `required: false`

Response uses `TripAttachmentResponseDto` where `file` is mapped from joined `TripAsset`.

## Request and Response Examples

Examples below focus on payload shape. Runtime responses are wrapped by the common `@Response` / `@ResponsePaging` envelope.

### Create draft (JSON)

```http
POST /shared/trips
Content-Type: application/json
```

```json
{
  "title": "Summer Italy 2026",
  "startDate": "2026-07-10T00:00:00.000Z",
  "endDate": "2026-07-20T00:00:00.000Z",
  "timezone": "Europe/Rome",
  "invites": [
    { "email": "traveler@example.com", "expiresAt": "2026-07-15T00:00:00.000Z" }
  ],
  "calendarEvents": [
    { "title": "Arrival", "category": "arrival", "startsAt": "2026-07-10T10:00:00.000Z" }
  ],
  "contactIds": ["6897a0af2d6f8e3cb8f5c111"]
}
```

`data` payload shape:

```json
{
  "id": "6897a31f2d6f8e3cb8f5c222",
  "slug": "summer-italy-2026-a1b2c3",
  "status": "draft"
}
```

### Update draft with optimistic concurrency

```http
PUT /shared/trips/:idTrip
Content-Type: application/json
```

```json
{
  "updatedAt": "2026-04-12T19:30:22.876Z",
  "subtitle": "Rome + Florence",
  "attachments": [
    {
      "title": "Insurance policy",
      "type": "INSURANCE",
      "required": true,
      "contentMarkdown": "Please review before departure."
    }
  ]
}
```

### Accept invite token

```http
POST /user/trips/invites/accept
Content-Type: application/json
```

```json
{
  "token": "raw-invite-token-from-client"
}
```

### Media multipart batch

```bash
curl -X POST "$API/shared/trips/{idTrip}/media" \
  -H "Authorization: Bearer <access-token>" \
  -H "x-api-key: <api-key>" \
  -F 'files=@photo1.jpg' \
  -F 'files=@video1.mp4' \
  -F 'data=[{"kind":"IMAGE","caption":"Hotel"},{"kind":"VIDEO","caption":"Transfer","calendarEventId":"6897a41d2d6f8e3cb8f5c333"}]'
```

### Attachment multipart batch

```bash
curl -X POST "$API/shared/trips/{idTrip}/attachments" \
  -H "Authorization: Bearer <access-token>" \
  -H "x-api-key: <api-key>" \
  -F 'files=@terms.pdf' \
  -F 'data=[{"title":"Terms and Conditions","type":"TERMS_AND_CONDITIONS","displayName":"Trip Terms"}]'
```

## Status Transition Matrix

### Trip status transitions

| Action | From | To | Result on invalid transition |
|---|---|---|---|
| publish | `draft` | `published` | `alreadyPublished (5405)` or `invalidTransition (5406)` |
| unpublish | `published` | `draft` | `notPublished (5402)` |
| cancel | `draft` / `published` | `cancelled` | `alreadyCancelled (5403)` / `alreadyArchived (5404)` |
| archive | `published` | `archived` | `alreadyArchived (5404)` / `notPublished (5402)` |

### Invite status transitions

| Action | From | To | Result on invalid transition |
|---|---|---|---|
| accept invite | `invited` | `accepted` | `inviteAlreadyAccepted (5423)`, `inviteRevoked (5422)`, `inviteExpired (5421)`, `inviteTokenInvalid (5424)` |
| revoke invite | `invited` / `accepted` | `revoked` | `inviteRevoked (5422)` or `inviteNotFound (5420)` |

## Read Surfaces

Shared read:

- `getTripList`: tenant-scoped list with optional status filter
- `getTrip`: tenant-scoped full detail (`calendarEvents`, `invites`, `contacts`, `medias`, `attachments`)

User read:

- `getUserTripList`: returns trips that are either `published` or where user is a traveler
- `getTripForUser`: returns detail only if user is traveler **and** trip is `published`

Traveler read (shared):

- `GET /trips/:idTrip/travelers`
- `GET /trips/:idTrip/travelers/:idTraveler`

## Data Visibility Rules

Current response-model behavior:

- shared trip detail (`getTrip`) returns full `TripResponseDto`, including `invites`, `contacts`, `medias`, `attachments`, and `calendarEvents`
- user trip detail (`getTripForUser`) also maps to `TripResponseDto`, so the same top-level collections are currently returned when access is allowed
- user trip detail is gated by both conditions:
  - user must be in `TripTraveler`
  - trip must be `published`
- user invite list returns invites where `tripInvite.userId` matches caller `userId` OR `tripInvite.email` matches caller JWT email
- shared traveler endpoints expose traveler user summary fields (`id`, `name`, `username`, `email`)

## Failure and Recovery Semantics

Upload and persistence behavior:

- icon/cover upload is `upload to S3 -> update trip row`; if DB update fails, uploaded object is deleted best-effort
- when replacing icon/cover, previous object is deleted best-effort after successful DB update
- media/attachment batch upload keeps list of uploaded keys; if any later step fails, uploaded keys are deleted best-effort
- media and attachment batch persistence is transactional inside `TripAssetRepository` (`tripAsset` + child row in a DB transaction)

Consistency behavior:

- invite acceptance uses a transaction (`acceptWithTraveler`) so invite status update and traveler creation are atomic
- draft update replacing media/attachments triggers orphan asset cleanup (`deleteOrphanByTrip`)
- status transitions (`publish`, `unpublish`, `cancel`, `archive`) do not use `updatedAt` optimistic token; only `updateDraft` enforces that concurrency check

## Error Codes and Messages

Trip status/error codes are in `EnumTripStatusCodeError` (`src/modules/trip/enums/trip.status-code.enum.ts`).

Main codes used by invite/media/attachment flows:

- `5420` invite not found
- `5421` invite expired
- `5422` invite revoked
- `5423` invite already accepted
- `5424` invite token invalid
- `5410` media calendar-event invalid
- `5401` not draft
- `5400` trip not found

Messages are under `src/languages/en/trip.json` keys:

- `trip.*` for trip operations
- `invite.*` for invite operations
- `error.*` for validation/state errors

## Current Implementation Gaps

The following behaviors are still incomplete in current code and should be tracked before production hardening:

1. Tenant context is placeholder-based in `TripSharedController` (`tenantId` is currently random, empty, or hardcoded in different endpoints).
2. Invite delivery is not implemented: raw invite tokens are hashed and stored but are not returned or sent by email/notification.
3. `createDraft` still has a TODO for duplicate-invite validation before persistence.
4. `updateDraft` currently replaces full collections (`deleteMany + create`) for itineraries/events/medias/attachments instead of diff-based updates.
5. Itinerary creation still has a TODO to validate airport IDs before persistence.
6. `trip.unpublish` response key is used by controller but is missing in `src/languages/en/trip.json`.
