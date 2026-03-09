# Asset Module Documentation

## Overview

The Asset module is a generic, permission-agnostic file lifecycle module.

It handles:
- receiving files from consumer modules,
- uploading file bytes to S3,
- storing asset metadata in database,
- hard delete from S3 and database.

It does not handle:
- ownership or authorization rules,
- entity-level visibility (Project, Tenant, etc.),
- sharing policies.

Those concerns must be implemented by the module that uses `AssetService`.

## Related Documents

- [File Upload Documentation][ref-doc-file-upload]
- [Presign Documentation][ref-doc-presign]
- [Authorization Documentation][ref-doc-authorization]
- [Project Documentation][ref-doc-project]
- [Tenant Documentation][ref-doc-tenant]

## Table of Contents

- [Overview](#overview)
- [Related Documents](#related-documents)
- [Service Scope](#service-scope)
- [Data Model](#data-model)
- [Integration Pattern](#integration-pattern)
- [Usage Scenarios](#usage-scenarios)
- [Design Guidelines](#design-guidelines)
- [Important Notes](#important-notes)

## Service Scope

`AssetService` provides core storage lifecycle methods:
- `upload(input, createdBy, options?)`
- `findOneById(assetId)`
- `findOneByUploaderId(assetId, uploaderId)`
- `findWithPaginationOffset(params)`
- `findWithPaginationCursor(params)`
- `delete(assetId, deletedBy)`

Method semantics:
- `findOneById`: neutral metadata lookup by id (authorization must be done by caller).
- `findOneByUploaderId`: ownership-scoped lookup.
- `delete`: ownership-scoped permanent delete (S3 object + DB row).

## Data Model

`Asset` model (Prisma):
- `id`
- `storageKey`
- `bucket`
- `access` (`public | private`)
- `filename`
- `completedUrl`
- `cdnUrl?`
- `mime`
- `extension`
- `size`
- `checksum?`
- `createdAt`, `createdBy`
- `updatedAt`, `updatedBy?`

Key fields:
- `storageKey`: technical S3 key for delete/retrieval operations.
- `filename`: display-friendly logical filename.
- `createdBy`: uploader identifier used for owner-scoped operations.

## Integration Pattern

Use this module as a shared infrastructure dependency:

```typescript
@Module({
  imports: [AssetModule],
  providers: [ProjectTransportService, ProjectTransportRepository],
})
export class ProjectTransportModule {}
```

Consumer module responsibilities:
1. Validate actor permissions on domain entity (Project, Ticket, etc.).
2. Resolve domain-level visibility rules.
3. Call `AssetService` for storage lifecycle.
4. Store entity-to-asset and visibility relations in domain tables.

## Usage Scenarios

### Personal Assets

Uploader owns assets and can list by `createdBy` filter:

```typescript
return this.assetService.findWithPaginationOffset({
  ...params,
  where: { ...params.where, createdBy: userId },
});
```

### User-to-User Share

Keep `AssetModule` unchanged and add a domain table (example: `UserAssetShare`) to control who can read specific assets.

### Project Attachments

For Project-based visibility:
- keep one domain relation table for attachment (`projectId` <-> `assetId`),
- keep one domain visibility model (all project readers or explicit subset),
- authorize actor first, then load asset by `assetId`.

## Design Guidelines

- Keep `AssetModule` domain-neutral and reusable.
- Keep project/tenant/user visibility logic outside `AssetService`.
- Do not use `findOneById` as an authorization shortcut; always authorize in domain service first.
- Use `findOneByUploaderId` only for owner-scoped flows.
- Use presigned URLs or direct URLs only after domain authorization.

## Important Notes

1. `AssetService` does not perform domain authorization.
2. Pagination does not auto-apply uploader/domain visibility filters.
3. `delete()` permanently removes asset metadata and the storage object.
4. If you need recoverability, implement a separate domain retention strategy.


<!-- REFERENCES -->

[ref-doc-file-upload]: ./file-upload.md
[ref-doc-presign]: ./presign.md
[ref-doc-authorization]: ./authorization.md
[ref-doc-project]: ./project.md
[ref-doc-tenant]: ./tenant.md
