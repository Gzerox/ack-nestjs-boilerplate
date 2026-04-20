# TripPolicy Domain

## Scope

This document describes the **TripPolicy entity/domain** only.

It does **not** describe trip lifecycle transitions (`publish`, `unpublish`, `archive`, `delete`) from the `Trip` aggregate.

## Intent

TripPolicy was intended to model legal-policy applicability for trips by linking policy ownership to tenant scope.

Core rule:

1. Connect policy scope to `Tenant`.
2. Do not add optional `TermPolicy.tripId` to the platform `TermPolicy` model.

## Why

`TermPolicy` is platform-level and global by nature.

If trip/tenant applicability is mixed into `TermPolicy` directly:

1. platform and tenant responsibilities are coupled
2. global publish semantics become harder to reason about
3. tenant/trip scoping leaks into a global legal-policy entity

## Domain Boundaries

### In Scope for TripPolicy

1. expressing which policies are required for trips in a tenant context
2. resolving applicable policies for a specific trip through tenant ownership
3. keeping trip/tenant policy linkage separate from platform `TermPolicy`

### Out of Scope for TripPolicy

1. trip status changes (`draft`, `published`, `archived`, `cancelled`)
2. trip CRUD mutability rules
3. invite lifecycle mechanics

Those belong to `Trip` domain docs.

## Suggested Shape (Conceptual)

Use a separate linkage entity (name can be `TripPolicy`, `TenantPolicy`, or another explicit link model), for example:

1. `tenantId`
2. `termPolicyId`
3. optional trip-target metadata (if trip-specific overrides are required)
4. required/active flags and timestamps

The important constraint is architectural, not naming:

1. keep `TermPolicy` global
2. keep tenant/trip applicability in a separate domain entity

## Current State

This repository currently implements `TermPolicy` as a platform module.

TripPolicy linkage modeling should be introduced as a dedicated domain model rather than extending `TermPolicy` with `tripId`.

## Related Docs

1. [Trip aggregate](trip.md)
2. [Trip form domain](trip-form.md)
3. [Term policy module](../../term-policy.md)
4. [Tenant policy design](../tenant/tenant-policy.md)
