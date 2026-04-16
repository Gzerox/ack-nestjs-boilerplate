# Tenant Form Template

## Scope

This file documents tenant-owned reusable form templates based on the current Prisma model `TenantFormTemplate`.

Runtime forms stay trip-owned through `TripForm`.

## Related Documents

1. Runtime form module: [../../form.md](../../form.md)
2. Trip form integration: [../trip/trip-form.md](../trip/trip-form.md)
3. Trip aggregate: [../trip/trip.md](../trip/trip.md)

## Goal

1. Allow tenant users to keep reusable form blueprints.
2. Allow trips in the same tenant to create forms from an existing template.
3. Keep execution concerns on `TripForm` only (publish, assignments, responses, summaries).

## Current Design Direction

`TenantFormTemplate` is intentionally simple:

1. no `draft/published/archived` lifecycle
2. only activation flag: `isActive`
3. no direct instantiate endpoint on template routes

Template consumption happens through trip form creation endpoint:

- `POST /trips/:idTrip/forms/from-template`

## Prisma Schema (Current)

```prisma
model TenantFormTemplate {
  id               String           @id @default(auto()) @map("_id") @db.ObjectId
  tenantId         String           @db.ObjectId
  kind             EnumTripFormKind
  title            String
  description      String?
  isActive         Boolean          @default(true)
  templateSnapshot Json

  tripForms TripForm[] @relation("TripFormTemplate")

  // timestamps fields
  createdAt DateTime @default(now())
  createdBy String   @db.ObjectId
  updatedAt DateTime @updatedAt
  updatedBy String?  @db.ObjectId

  @@index(fields: [tenantId, isActive])
  @@map("TenantFormTemplates")
}
```

## Entity Notes

1. `TenantFormTemplate` belongs to exactly one tenant (`tenantId`).
2. `templateSnapshot` stores the reusable schema blueprint.
3. `TripForm.templateId` is an optional reference to the source template used for cloning.
4. A template is reusable across many trips in the same tenant.
5. `isActive = false` means the template should not be selectable for new trip form creation.
6. Existing `TripForm` records cloned earlier remain unchanged if template is updated/deactivated later.

## Status Model

There is no multi-state workflow for templates.

Template state is only:

1. `isActive = true`
2. `isActive = false`

No `publish` or `archive` endpoint is required for `TenantFormTemplate`.

## Controllers (Proposed)

Tenant template management endpoints:

1. `POST /shared/tenant-form-templates`
2. `GET /shared/tenant-form-templates`
3. `GET /shared/tenant-form-templates/:idTemplate`
4. `PUT /shared/tenant-form-templates/:idTemplate`
5. `PATCH /shared/tenant-form-templates/:idTemplate/active`
6. `DELETE /shared/tenant-form-templates/:idTemplate`

Explicitly not included:

1. `POST /shared/tenant-form-templates/:idTemplate/instantiate` (removed)

Instantiation/cloning remains owned by trip form endpoints:

1. `POST /trips/:idTrip/forms/from-template`

## DTO Sketch

### `TenantFormTemplateCreateRequestDto`

```json
{
  "kind": "survey",
  "title": "Pre-departure checklist",
  "description": "Traveler preparation",
  "templateSnapshot": {}
}
```

### `TenantFormTemplateUpdateRequestDto`

```json
{
  "kind": "survey",
  "title": "Pre-departure checklist v2",
  "description": "Updated traveler preparation",
  "templateSnapshot": {}
}
```

### `TenantFormTemplateUpdateActiveRequestDto`

```json
{
  "isActive": false
}
```

## Validation Rules

1. `tenantId` must always come from trusted auth context, never from client body.
2. All read/write operations must be tenant-scoped.
3. `templateSnapshot` must satisfy the same structural rules expected by trip-form cloning flow.
4. `POST /trips/:idTrip/forms/from-template` must ensure `trip.tenantId = template.tenantId`.
5. Trip form creation from template must reject inactive templates (`isActive = false`).

## Deletion Semantics

1. Template deletion is allowed through `DELETE /shared/tenant-form-templates/:idTemplate`.
2. Deleting a template does not delete existing `TripForm` records already created from it.
3. If safer for audit, this endpoint can be implemented as soft-delete in service behavior while keeping the API contract as delete.

## Activity Log

Expected activity actions already present in schema enum:

1. `adminTenantFormTemplateCreate`
2. `adminTenantFormTemplateUpdate`
3. `adminTenantFormTemplateDelete`

## Non-Goals

1. No template version graph.
2. No inheritance/composition between templates.
3. No direct assignment or response data on templates.
4. No standalone template-instantiation endpoint.
