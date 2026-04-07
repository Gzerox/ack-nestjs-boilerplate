# Trip Form Integration

## Scope

This file documents how forms belong directly to trips.

There is no separate trip-to-form bridge model in this approach.

## Related Documents

1. Directory index: [README.md](README.md)
2. Trip aggregate: [trip.md](trip.md)
3. Runtime form lifecycle: [../../form.md](../../form.md)
4. Trip traveler scope: [trip-traveler.md](trip-traveler.md)

## Prisma Draft Schema

Recommended ownership model:

```prisma
model Trip {
  id        String @id @default(uuid())
  // ...

  forms     Form[]
}

model Form {
  id             String         @id @default(auto()) @map("_id") @db.ObjectId
  tripId         String
  kind           EnumFormKind
  title          String
  description    String?
  status         EnumFormStatus @default(draft)
  schemaSnapshot Json
  closesAt       DateTime?
  publishedAt    DateTime?

  trip           Trip             @relation(fields: [tripId], references: [id], onDelete: Cascade)
  sections       FormSection[]    @relation("FormSections")
  questions      FormQuestion[]   @relation("FormQuestions")
  assignments    FormAssignment[] @relation("FormAssignments")

  @@index([tripId])
  @@index([tripId, status])
}
```

## Entity Notes

1. A `Form` belongs to exactly one trip through `tripId`.
2. `Trip` exposes `forms Form[]`.
3. There is no bridge table between `Trip` and `Form`.
4. Cross-trip reuse happens by copying a form into a new `Form` row for another trip.
5. `FormAssignment` remains the per-user delivery record for a trip-owned form.

## Controllers

Preferred creation flow:

- `POST /shared/trips/:idTrip/forms`

This route creates a new draft form owned by the trip.

After creation, runtime form management remains centered on the form module:

- `PATCH /shared/forms/:idForm`
- `POST /shared/forms/:idForm/publish`
- `POST /shared/forms/:idForm/assignments`
- `POST /shared/forms/:idForm/archive`
- `GET /shared/forms/:idForm/metrics`
- `GET /shared/forms/:idForm/responses`
- `GET /shared/forms/:idForm/questions/:questionId/summary`

## DTOs

### `TripOwnedFormCreateRequestDto`

Trip-owned form creation reuses the runtime form draft payload:

- `kind: EnumFormKind`
- `title: string`
- `description?: string`
- `closesAt?: Date`
- `sections: FormSchemaSectionRequestDto[]`

`tripId` is taken from the URL path parameter, not the request body.

## Assignment Semantics

`FormAssignment` is still required even when forms are trip-owned.

Responsibilities:

- `Trip`: ownership scope
- `Form`: questionnaire definition for that trip
- `FormAssignment`: which specific user must answer the form

Default rules:

1. Creating a form under a trip does not automatically assign it to all travelers.
2. Assignments may target only users who belong to the trip through `TripTraveler`.
3. Assignment scheduling, required/optional behavior, and active/inactive state remain assignment-level concerns.
4. User-facing submission remains assignment-scoped.

## Validation Rules

1. `tripId` is always required.
2. A form must always belong to one trip.
3. Draft and publish checks must validate the form inside its trip scope.
4. Assignments for a trip-owned form must target users who belong to the same trip.
5. Reuse across trips must create a new copied `Form`; one form record cannot belong to multiple trips.

## Authorization and Visibility

1. Backend-user access to form creation is controlled by trip aggregate write access.
2. Runtime form management permissions still apply when mutating the form after creation.
3. End-user `/user/forms` reads may include trip context directly through `Form.tripId`.
