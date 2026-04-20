# Trip Contact (Current)

## Scope

`TripContact` is the junction/connection model between:

1. `Trip`
2. `TenantContact`

Each trip can reference one or many tenant contacts for operational reasons, for example:

1. hotel assistance
2. flight contact point
3. pickup/transfer agent
4. emergency local contact

`TenantContact` records are tenant-owned and managed in the tenant-contact domain:
[Tenant Contact](../tenant/tenant-contact.md).

## Data Model

1. `TripContact` has `(tripId, contactId)` unique constraint.
2. Contact rows remain tenant-owned; trips only reference them.
3. `TripResponseDto.contacts` exposes mapped `TenantContactResponseDto[]` (not `TripContact` rows).

## Endpoints That Directly Impact `TripContact` (Paths After `/api/v1`)

There is no dedicated trip-contact controller; writes happen through trip endpoints.

| Method | Path | Direct impact on `TripContact` |
| --- | --- | --- |
| `POST` | `/shared/trips` | Creates initial `TripContact` links from optional `contactIds` on draft creation. |
| `PUT` | `/shared/trips/:idTrip/contacts` | Replaces all links for the trip (`deleteMany` + `create`). |

## Validation

1. Submitted `contactIds` are validated against active tenant contacts.
2. Missing or cross-tenant contacts fail with `contactNotFound`.
3. Duplicate links are prevented by DB unique constraint.

## Lifecycle Behavior

| Event | Endpoint (after `/api/v1`) | What happens to `TripContact` links |
| --- | --- | --- |
| Backoffice deletes trip | `DELETE /shared/trips/:idTrip` | Trip is soft-deleted (`deletedAt`, `deletedBy`). `TripContact` rows are not physically deleted by this flow. Trip is excluded from normal reads, so linked contacts are not reachable through regular trip APIs. |
| Backoffice deletes tenant contact | `DELETE /shared/contacts/:idContact` | Tenant contact is soft-deleted in tenant-contact module. `TripContact` rows are not physically deleted by this flow and are not auto-unlinked. |

Current read implication:

1. Trip detail queries include linked `contact` records without an explicit `deletedAt: null` filter on the nested relation.
2. A soft-deleted tenant contact may remain visible in trip contact payloads until trip contacts are replaced.

Additional schema note:

1. `TripContact.trip` and `TripContact.contact` relations are defined with `onDelete: Cascade`.
2. Cascade applies when a parent record is physically deleted at DB level, not when it is soft-deleted.
