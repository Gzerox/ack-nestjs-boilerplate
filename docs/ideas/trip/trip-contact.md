# Trip Contact Implementation

## Scope

This file owns the trip-specific contact linkage:

1. `TripContact`

The tenant-owned contact book itself is documented in [../tenant/tenant-contact.md](../tenant/tenant-contact.md).

## Related Documents

1. Trip domain (consolidated): [trip.md](trip.md)
2. Tenant contact scope: [../tenant/tenant-contact.md](../tenant/tenant-contact.md)

## Domain Model

1. `TripContact` is the link table between `Trip` and `TenantContact`.
2. `TripContact` is used to expose support and assistance references inside trip details shown to travelers.
3. The contact records remain tenant-owned and reusable across many trips.

## Prisma Draft Schema

```prisma
model TripContact {
  id        String        @id @default(uuid())
  tripId    String
  contactId String

  trip      Trip          @relation(fields: [tripId], references: [id], onDelete: Cascade)
  contact   TenantContact @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([tripId, contactId])
  @@index([tripId])
  @@index([contactId])
}
```

## Entity Notes

1. `TripContact` must only link a trip to contacts in the same tenant.
2. `POST /shared/trips` receives contacts as a list of existing `TenantContact` `ObjectId` values.
3. The service creates `TripContact[]` internally from that contact id list.
4. `PUT /shared/trips/:idTrip` should sync the link table against the submitted list of contact ids.
5. The `Trip` model exposes `contacts TripContact[]` on the aggregate root.

## Response DTOs

#### `TripContactResponseDto` (embedded in `TripResponseDto` and `TripUserResponseDto`)

- `id: string` (TripContact id)
- `contact: TenantContactResponseDto`

## Write Flows

There is no dedicated `TripContact` controller.

Trip linkage is handled inside trip write endpoints:

1. `POST /shared/trips` validates all submitted contact ids against tenant-visible, non-deleted `TenantContact` records, then creates `TripContact[]`.
2. `PUT /shared/trips/:idTrip` replaces or reconciles existing `TripContact[]` rows to match the current payload.

## End-user Surface

There are no dedicated end-user contact endpoints.

Traveler clients receive trip contacts through:

1. `GET /user/trips/:idTrip` (embedded in `TripUserResponseDto.contacts`)

## Validation Rules

1. `TripContact` must not connect a trip to a `TenantContact` owned by another tenant.
2. Duplicate trip-contact links must be prevented by `(tripId, contactId)`.
3. `POST /shared/trips` contact ids must all belong to `TenantContact` records visible in the current tenant (non-deleted).
4. `PUT /shared/trips/:idTrip` must not retain links to soft-deleted contacts.

## Authorization and Visibility

1. `TripContact` writes are backend-user only because they happen through shared trip management endpoints.
2. All links are tenant-scoped through both the parent `Trip` and the referenced `TenantContact`.
3. End users only see contacts through trips they are allowed to access.
