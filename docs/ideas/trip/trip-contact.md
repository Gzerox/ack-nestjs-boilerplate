# Trip Contact Implementation

## Scope

This file owns the support-contact side of the Trip domain:

1. `Contact`
2. `TripContact`

These entities provide assistance and support points of reference for travelers.

## Related Documents

1. Directory index: [README.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/README.md)
2. Trip aggregate: [trip.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip.md)
3. Media scope: [trip-media.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-media.md)
4. Attachment scope: [trip-attachments.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-attachments.md)

## Domain Model

1. `Contact` is the tenant-scoped contact book. It stores every contact ever added for a given tenant.
2. `TripContact` is the link table between `Trip` and `Contact`.
3. `TripContact` is used to expose support and assistance references inside trip details shown to travelers.

## Prisma Draft Schema

```prisma
model Contact {
  id              String        @id @default(uuid())
  tenantId        String
  firstName       String
  lastName        String
  category        String?       @db.VarChar(80)
  phoneE164       String?       @db.VarChar(32)
  email           String?       @db.VarChar(320)
  notes           String?       @db.Text
  deletedAt       DateTime?
  deletedBy       String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  trips           TripContact[]

  @@index([tenantId])
  @@index([tenantId, deletedAt])
}

model TripContact {
  id              String        @id @default(uuid())
  tripId          String
  contactId       String

  trip            Trip          @relation(fields: [tripId], references: [id], onDelete: Cascade)
  contact         Contact       @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([tripId, contactId])
  @@index([tripId])
  @@index([contactId])
}
```

## Entity Notes

1. Every `Contact` belongs to exactly one tenant.
2. `Contact` is reusable across many trips in the same tenant.
3. `DELETE /shared/contacts/:idContact` is a soft-delete, so the schema includes `deletedAt` and `deletedBy`.
4. `TripContact` should only link a trip to contacts in the same tenant.
5. `POST /shared/trips` receives contacts as a list of existing contact `ObjectId` values.
6. The service creates `TripContact[]` internally from that contact id list.
7. The `Trip` model needs `contacts TripContact[]` on the aggregate root.

## Controllers

### `trip-contact.shared.controller`

Backend-user management endpoints:

#### `GET /shared/contacts`

List all contacts for the current tenant.

Tenant scope comes from `x-tenant-id` for now and must only return non-deleted contacts that belong to that tenant.

#### `POST /shared/contacts`

Create a new contact for the current tenant.

`tenantId` must come from `x-tenant-id`, not from the client payload.
The response should include the created contact id so the client can reuse it in `POST /shared/trips`.

#### `PUT /shared/contacts/:idContact`

Update an existing contact.

The service must first verify that the contact belongs to the current tenant.

#### `DELETE /shared/contacts/:idContact`

Soft-delete an existing contact by setting `deletedAt`.

The service must first verify that the contact belongs to the current tenant.
The service should also stamp `deletedBy`.

## Tenant Access

1. Every management endpoint must verify that the caller has access to the tenant identified by `x-tenant-id`.
2. A future implementation may leverage the Tenant Decorator once it is available on the target branch.
3. This section should be updated once the Tenant Decorator contract is finalized.

## End-user Surface

There are no dedicated end-user contact endpoints.

Traveler clients receive trip contacts through:

1. `GET /user/trips/:idTrip`

## Validation Rules

1. `Contact.tenantId` always comes from trusted context, never from client payload.
2. Soft-deleted contacts must be excluded from standard list results.
3. `TripContact` must not connect a trip to a contact owned by another tenant.
4. Duplicate trip-contact links must be prevented by `(tripId, contactId)`.
5. `POST /shared/trips` contact ids must all belong to contacts visible in the current tenant.

## Authorization and Visibility

1. Shared contact management is backend-user only.
2. All reads and writes are tenant-scoped.
3. End users only see contacts through trips they are allowed to access.
