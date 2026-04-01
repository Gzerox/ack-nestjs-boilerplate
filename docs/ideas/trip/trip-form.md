# Trip Form Implementation

## Scope

This file owns trip links to external forms:

1. `TripForm`

## Related Documents

1. Directory index: [README.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/README.md)
2. Trip aggregate: [trip.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip.md)
3. Contact scope: [trip-contact.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-contact.md)
4. Media scope: [trip-media.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-media.md)
5. Attachment scope: [trip-attachments.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-attachments.md)

## Prisma Draft Schema

```prisma
model TripForm {
  id         String   @id @default(uuid())
  tripId     String
  formId     String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  trip       Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)

  @@unique([tripId, formId])
  @@index([tripId])
  @@index([formId])
}
```

## Entity Notes

1. `TripForm` links a trip to a form created through the form module.
2. The `Trip` model should expose `forms TripForm[]`.
3. `POST /shared/forms` creates the form resource and returns its id.
4. `POST /shared/trips` receives forms as a list of existing form `ObjectId` values.
5. The service creates `TripForm[]` internally from that form id list.

## Controllers

No dedicated trip-form controller is expected for now.

Form resources themselves are created by the form module through `POST /shared/forms`.

## Validation Rules

1. `tripId` is always required.
2. `formId` must reference an existing form visible to the current tenant context.
3. Duplicate links must be prevented by `(tripId, formId)`.
4. `POST /shared/trips` form ids must all reference forms already created through the form module.

## Authorization and Visibility

1. Backend-user access to trip-form linkage is controlled by trip aggregate write access.
2. End-user exposure should only be defined after form visibility rules are finalized.
