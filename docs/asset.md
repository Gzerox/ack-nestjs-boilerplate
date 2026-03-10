# Asset Module Documentation

## Overview

The Asset module is a generic, permission-agnostic file lifecycle module.

It handles:

- receiving files from consumer modules,
- uploading file bytes to S3,
- storing asset metadata in database,
- hard delete from S3 and database.

It does not handle:

- scope/entity ownership and authorization,
- visibility rules inside a domain entity,
- sharing policies between users in a scope.

Those concerns must be implemented by the consumer domain module.

## Related Documents

- [File Upload Documentation][ref-doc-file-upload]
- [Presign Documentation][ref-doc-presign]
- [Authorization Documentation][ref-doc-authorization]

## Table of Contents

- [Overview](#overview)
- [Related Documents](#related-documents)
- [Service Scope](#service-scope)
- [Data Model](#data-model)
- [Generic Integration Model](#generic-integration-model)
- [Visibility Modes](#visibility-modes)
- [Scenario Guide](#scenario-guide)
- [Example Scope-Side Tables](#example-scope-side-tables)
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

## Generic Integration Model

`AssetModule` manages storage lifecycle; your domain module manages authorization and visibility.

Use this module as shared infrastructure:

```typescript
@Module({
    imports: [AssetModule],
    providers: [YourDomainAssetService, YourDomainAssetRepository],
})
export class YourDomainModule {}
```

Use these scope coordinates in domain services:

- `scopeType`: domain namespace
- `scopeId`: id of the domain entity

Integration checklist:

1. Authorize actor for the target scope.
2. Resolve visibility rules for that scope.
3. Call `AssetService` for upload/get/delete lifecycle.
4. Persist scope-to-asset relation data in domain tables.

## Visibility Modes

Use any naming you want in your domain. Common examples:

- `ownerOnly`: only the uploader can access.
- `scopeMembers`: any active user with scope access can access.
- `selectedUsers`: uploader plus explicitly granted users can access.

These labels are examples only. `AssetService` does not enforce them.

## Scenario Guide

Minimal consumer patterns:

### 1) Upload to Scope, Uploader-Only Visibility

When to use:

- The file belongs to one scope entity.
- Only the uploader should read/download it.

Flow:

1. Validate user can upload to `scopeType/scopeId`.
2. Upload via `AssetService.upload(...)`.
3. Save relation in your domain table with mode `ownerOnly`.
4. On read/download, verify uploader ownership, then return metadata or presign.

### 2) Upload to Scope, Visible to Everyone in Scope

When to use:

- The file belongs to one scope entity.
- Any current scope member should read/download it.

Flow:

1. Validate user can upload and set scope visibility.
2. Upload via `AssetService.upload(...)`.
3. Save relation with mode `scopeMembers`.
4. On read/download, verify current scope membership, then return metadata or presign.

Variant: Selected users in scope (`selectedUsers`)

Store user grants in a separate domain table and allow read/download only for uploader or granted active users.

## Example Scope-Side Tables

Example domain-side schema (not part of `AssetModule`):

- `ScopeAssetAttachment`:
  - `id`
  - `scopeType`
  - `scopeId`
  - `assetId`
  - `visibilityMode`

- `ScopeAssetAccess` (used for `selectedUsers`):
  - `id`
  - `attachmentId`
  - `userId`

Minimum required fields are scope relation (`scopeType`, `scopeId`, `assetId`) and, for selected users, per-user grants.

First version lifecycle: hard delete relation rows when unlinked; orphan-storage policy stays domain-defined.

## Design Guidelines

- Keep `AssetModule` domain-neutral and reusable.
- Keep scope/entity visibility logic outside `AssetService`.
- Always authorize in domain service before returning metadata, direct URLs, or presigned URLs.
- Use `findOneByUploaderId` only for owner-scoped flows.
- Treat mode names in this document as examples, not shared contracts.

## Important Notes

1. `AssetService` does not perform domain authorization.
2. `findOneById` is metadata lookup only; it is not an authorization check.
3. Pagination does not auto-apply uploader/domain visibility filters.
4. `delete()` permanently removes asset metadata and storage object.
5. Orphan cleanup and retention strategy are intentionally out of scope in this first version.

<!-- REFERENCES -->

[ref-doc-file-upload]: ./file-upload.md
[ref-doc-presign]: ./presign.md
[ref-doc-authorization]: ./authorization.md
