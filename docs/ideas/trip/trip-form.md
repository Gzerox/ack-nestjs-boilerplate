# Trip Form (Current)

This document reflects `src/modules/trip-form/*` as implemented.

## Domain Intent

TripForm is used to gather traveler information so backoffice users can prepare a trip for customers.

1. `TripForm` belongs to one `Trip` (`tripId`).
2. Optional template source via `TenantFormTemplate` (`templateId`).
3. Publishing materializes `TripFormSection` and `TripFormQuestion` rows from `schemaSnapshot`.
4. `TripFormAssignment` is a per-user delivery instance.
5. `TripFormAnswer` stores submitted answers by `assignmentId` + `questionId`.

Related clarification:

1. The `TripPolicy` legal-policy direction is tenant-scoped. It should connect `TermPolicy` to `Tenant`, instead of adding an optional `TermPolicy.tripId`.

## Statuses

Form status (`EnumTripFormStatus`):

1. `draft`
2. `published`
3. `archived`

Assignment response status (`EnumTripFormResponseStatus`):

1. `pending`
2. `submitted`

## Shared Endpoints

| Method   | Path (after `/api/v1`)                                 | Purpose                                             |
| -------- | ------------------------------------------------------ | --------------------------------------------------- |
| `POST`   | `/shared/trips/:idTrip/forms/from-template`            | Create a form draft from a tenant template.         |
| `POST`   | `/shared/trips/:idTrip/forms`                          | Create a form draft from direct schema payload.     |
| `GET`    | `/shared/trips/:idTrip/forms`                          | List forms for the trip.                            |
| `GET`    | `/shared/trips/:idTrip/forms/:idForm`                  | Get one form detail.                                |
| `PATCH`  | `/shared/trips/:idTrip/forms/:idForm`                  | Update a draft form.                                |
| `PATCH`  | `/shared/trips/:idTrip/forms/:idForm/publish`          | Publish a draft form.                               |
| `POST`   | `/shared/trips/:idTrip/forms/:idForm/assignments`      | Assign a published form to a user.                  |
| `PATCH`  | `/shared/trips/:idTrip/forms/:idForm/archive`          | Archive a published form.                           |
| `DELETE` | `/shared/trips/:idTrip/forms/:idForm`                  | Soft-delete a draft form.                           |
| `GET`    | `/shared/trips/:idTrip/forms/:idForm/metrics`          | Get form assignment/response metrics.               |
| `GET`    | `/shared/trips/:idTrip/forms/:idForm/responses`        | List responses/assignments for one form.            |
| `GET`    | `/shared/trips/:idTrip/forms/:idForm/responses/export` | Export responses for all assignments in CSV format. |

## User Endpoints

| Method | Path (after `/api/v1`)                                               | Purpose                                              |
| ------ | -------------------------------------------------------------------- | ---------------------------------------------------- |
| `GET`  | `/user/trips/:idTrip/forms`                                          | List current user's active assignments for the trip. |
| `GET`  | `/user/trips/:idTrip/forms/:idForm/assignments/:assignmentId`        | Load one assigned form with current answers.         |
| `POST` | `/user/trips/:idTrip/forms/:idForm/assignments/:assignmentId/submit` | Submit answers for the assignment.                   |

User endpoints also require `@TermPolicyAcceptanceProtected()`.

## State Rules

1. Update (`PATCH /shared/trips/:idTrip/forms/:idForm`) allowed only in `draft`.
2. Publish allowed only in `draft`.
3. Archive allowed only in `published`.
4. Delete (soft delete) allowed only in `draft`.
5. Assignment creation allowed only when form is `published` and no active assignment exists for user.

Explicitly:

1. A form in `draft` status cannot be assigned.

## Assignment Access Rules

For user get/submit:

1. assignment must exist for `(assignmentId, userId, tripId)`
2. assignment must be active
3. assignment must belong to requested form
4. form must be `published`
5. now must be within assignment `[startsAt, closesAt)` when provided

Submit also enforces:

1. no duplicate `questionId` in one payload
2. all question ids must exist in that form
3. assignment not already submitted

## Metrics Endpoint

`GET /shared/trips/:idTrip/forms/:idForm/metrics` returns:

1. `assignedCount`
2. `pendingCount`
3. `submittedCount`
4. `completionRate` (rounded to 2 decimals)

## CSV Export Endpoint

`GET /shared/trips/:idTrip/forms/:idForm/responses/export` returns a CSV file.

Behavior:

1. One row per assignment/response.
2. Includes base columns (`assignmentId`, `userId`, `status`, `required`, `startsAt`, `closesAt`, `submittedAt`).
3. Includes one dynamic column per published question.
4. Question columns are ordered by section position, then question position.
5. If no assignments exist yet, the CSV still contains the header row.

## Clarifications

1. There is no `/shared/trips/:idTrip/forms/:idForm/questions/:questionId/summary` endpoint in current controllers.
2. `TripFormAssignment.tripId` is used directly for trip-scoped queries.
