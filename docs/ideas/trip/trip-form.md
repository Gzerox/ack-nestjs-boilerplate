# Trip Form Implementation

## Scope

This file owns trip links to external forms:

1. `TripForm`

## Related Documents

1. Directory index: [README.md](README.md)
2. Trip aggregate: [trip.md](trip.md)
3. Contact scope: [trip-contact.md](trip-contact.md)
4. Media scope: [trip-media.md](trip-media.md)
5. Attachment scope: [trip-attachments.md](trip-attachments.md)

## Prisma Draft Schema

```prisma
model TripForm {
  id        String   @id @default(uuid())
  tripId    String
  formId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  trip      Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)

  @@unique([tripId, formId])
  @@index([tripId])
  @@index([formId])
}
```

## Entity Notes

1. `TripForm` links a trip to a form created through the form module.
2. The `Trip` model exposes `forms TripForm[]`.
3. `POST /shared/forms` creates the form resource and returns its id.
4. `POST /shared/trips` receives forms as a list of existing form `ObjectId` values.
5. The service creates `TripForm[]` internally from that form id list.

## Module Dependency Note

`TripModule` must import `FormModule` to validate form existence and status before creating `TripForm` links.

Prefer adding a method `existByIdAndStatus(formId: string, status: EnumFormStatus): Promise<boolean>` to `FormRepository` rather than injecting `FormService`, to avoid circular dependency risk.

## Controllers

No dedicated trip-form controller is expected for now.

Form resources themselves are created by the form module through `POST /shared/forms`.

## DTOs

`TripForm` links are **not** submitted as nested objects. They are passed as a flat array of form ids in the parent trip request DTOs:

- In `TripCreateDraftRequestDto`: `formIds?: string[]`
- In `TripUpdateDraftRequestDto`: `formIds?: string[]`

The service resolves each id to a `TripForm` link internally.

### `TripFormResponseDto`

Returned as part of `TripResponseDto.forms[]` (backend detail only):

- `id: string`
- `tripId: string`
- `formId: string`
- `createdAt: Date`

`TripFormResponseDto` is **not** included in `TripUserResponseDto`. End-user form exposure should only be defined after form visibility rules are finalized.

## Validation Rules

1. `tripId` is always required.
2. `formId` must reference an existing form with `status = PUBLISHED` in the current tenant context. Draft or archived forms may not be linked to a trip.
   - The service calls `FormRepository.existByIdAndStatus(formId, EnumFormStatus.published)`.
   - On failure, throw `BadRequestException` with `EnumFormStatusCodeError.formNotPublished` and message key `form.error.formNotPublished`.
3. Duplicate links must be prevented by `(tripId, formId)`.
4. All `formIds` submitted in `POST /shared/trips` must pass the status check before any `TripForm` record is created.

## Authorization and Visibility

1. Backend-user access to trip-form linkage is controlled by trip aggregate write access.
2. End-user exposure should only be defined after form visibility rules are finalized.
