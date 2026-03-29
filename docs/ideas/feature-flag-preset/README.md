---
title: Feature Flag Preset System — Index
status: developing
stage: spec
feature_id: feature-flag-preset
owner: product
last_reviewed: 2026-03-29
note_type: implementation-spec
---

# Feature Flag Preset System — Index

## Index

- [Goal](#goal)
- [Document Map](#document-map)
- [Approach Summary](#approach-summary)
- [Version Comparison](#version-comparison)
- [Recommended Evolution](#recommended-evolution)
- [References](#references)

## Goal

Document the evolution of tenant-scoped feature flag control from a simple direct override model to a reusable preset-based model, while keeping the `@FeatureFlagProtected('key')` decorator unchanged.

## Document Map

- [Version 1 Spec](v1.md): direct tenant override model
- [Version 2 Spec](v2.md): reusable preset model for multi-tenant assignment

## Approach Summary

### Version 1

Version 1 introduces `TenantFeatureFlagConfig`, a direct per-tenant, per-flag override.

Use v1 when:

- a tenant needs a one-off exception
- the number of customizations is still small
- fast delivery matters more than reuse

Resolution:

```text
TenantFeatureFlagConfig -> FeatureFlag
```

### Version 2

Version 2 introduces `FeatureFlagPreset` plus `TenantFeatureFlagPreset`, allowing the same bundle of flag decisions to be assigned to many tenants.

Use v2 when:

- multiple tenants should share the same feature package
- operators need reusable rollout bundles
- platform teams want to update many tenants through one preset definition

Resolution:

```text
TenantFeatureFlagConfig -> FeatureFlagPreset -> FeatureFlag
```

## Version Comparison

| Area | Version 1 | Version 2 |
|---|---|---|
| Main abstraction | Direct tenant override | Reusable named preset |
| Best fit | One-off tenant exceptions | Shared bundles across many tenants |
| Operational cost | Repeated writes per tenant | Define once, assign many |
| Change propagation | Update each tenant separately | Update preset once |
| Resolution stack | Tenant override -> global | Tenant override -> preset -> global |
| Exception handling | Native | Native, via tenant override above preset |
| Complexity | Low | Medium |

## Recommended Evolution

The intended rollout remains:

1. Deliver v1 first because it is small, explicit, and easy to validate.
2. Add v2 when repeated tenant override patterns start appearing in operations.
3. Keep direct tenant overrides in v2 as the highest-priority exception layer.
4. Start v2 with at most one active preset per tenant to avoid preset merge ambiguity.

## References

- [Version 1 Spec](v1.md)
- [Version 2 Spec](v2.md)
