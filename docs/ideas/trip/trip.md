# Trip Docs (Topic Split)

This folder documents the current implementation in:

- `src/modules/trip/*`
- `src/modules/trip-form/*`

## Route Composition

With default app config, effective paths are composed as:

1. global prefix: `/api`
2. URI versioning (when enabled): `/v1`
3. router prefix: `/public` | `/shared` | `/user`
4. controller path: declared in controller

Effective controller roots after `/api/v1`:

| Surface | Root Path |
| --- | --- |
| Public trip controller | `/public/trips` |
| Shared trip controller | `/shared/trips` |
| User trip controller | `/user/trips` |
| User trip-form controller | `/user/trips` |

## Topic Documents

1. [Trip Policy](trip-policy.md)
2. [Trip Invite](trip-invite.md)
3. [Trip Contact](trip-contact.md)
4. [Trip Traveler](trip-traveler.md)
5. [Trip Form](trip-form.md)

## Integrated Update Workflow

The previous standalone trip update workflow note is integrated here.

### Base Update

| Method | Path (after `/api/v1`) | Purpose |
| --- | --- | --- |
| `PUT` | `/shared/trips/:idTrip` | Update scalar/base fields (`title`, `subtitle`, `description`, `icon`, `coverImage`, `timezone`, dates). |

### Relation Updates

| Method | Path (after `/api/v1`) | Purpose |
| --- | --- | --- |
| `PUT` | `/shared/trips/:idTrip/calendar-events` | Full replacement of trip calendar events. |
| `PUT` | `/shared/trips/:idTrip/contacts` | Full replacement of trip contacts. |
| `PUT` | `/shared/trips/:idTrip/itineraries` | Full replacement of trip itineraries. |
| `POST` | `/shared/trips/:idTrip/invites` | Append invite records. |
| `POST` | `/shared/trips/:idTrip/media` | Append media assets. |
| `POST` | `/shared/trips/:idTrip/attachments` | Append attachment assets. |

### Status Operations

| Method | Path (after `/api/v1`) | Purpose |
| --- | --- | --- |
| `PATCH` | `/shared/trips/:idTrip/publish` | Publish draft trip. |
| `PATCH` | `/shared/trips/:idTrip/unpublish` | Move published trip back to draft. |
| `PATCH` | `/shared/trips/:idTrip/archive` | Archive published trip. |
| `DELETE` | `/shared/trips/:idTrip` | Soft delete (draft only). |

### Not Implemented

| Method | Path (after `/api/v1`) | Note |
| --- | --- | --- |
| `PATCH` | `/shared/trips/:idTrip/cancel` | Not implemented. |
| `PUT` | `/shared/trips/:idTrip/travelers` | Not implemented. |
| `PUT` | `/shared/trips/:idTrip/attachments` | Replacement endpoint not implemented. |

### Practical Semantics

1. Update ownership is split by endpoint scope.
2. `PUT /shared/trips/:idTrip` requires `updatedAt` optimistic concurrency token.
3. In `published`, `startDate` and `endDate` updates are rejected.
4. Calendar events, contacts, and itineraries are overwrite-style.
5. Invites, media, and attachments are create/append-style.
6. Upload endpoints require `files.length === metadata.length`.
