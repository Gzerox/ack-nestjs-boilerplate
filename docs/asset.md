# Asset Module Documentation

This documentation explains the purpose and usage of the **Asset Module**:
- **Asset Module**: Located at `src/modules/asset`
- **Asset Service**: Located at `src/modules/asset/services/asset.service.ts`
- **Asset Repository**: Located at `src/modules/asset/repositories/asset.repository.ts`

## Overview

The Asset module is a **generic, permission-agnostic file lifecycle module**.
It handles only:
- receiving a file from consumer modules,
- uploading file bytes to S3,
- storing file metadata in database,
- metadata updates,
- soft-delete + S3 delete.

The module does **not** implement ownership authorization, sharing, project visibility, or access-control rules.
Those concerns must be implemented by the module that uses `AssetService`.

## Related Documents

- [File Upload Documentation][ref-doc-file-upload]
- [Presign Documentation][ref-doc-presign]
- [Authorization Documentation][ref-doc-authorization]
- [Project Documentation][ref-doc-project]
- [Tenant Documentation][ref-doc-tenant]

## Table of Contents

- [Overview](#overview)
- [Current Scope](#current-scope)
- [Data Model](#data-model)
- [Public Service API](#public-service-api)
- [How Other Modules Should Use It](#how-other-modules-should-use-it)
- [Basic Scenario: User Owns Multiple Assets](#basic-scenario-user-owns-multiple-assets)
- [Standard Scenario: User Upload and User-to-User Share](#standard-scenario-user-upload-and-user-to-user-share)
- [Advanced Scenario (In Progress): Project and Member Access](#advanced-scenario-in-progress-project-and-member-access)
- [Design Guidelines](#design-guidelines)
- [Important Notes](#important-notes)

## Current Scope

`AssetService` currently provides:
- `upload(input, createdBy, options?)`
- `getOne(assetId)`
- `listByUploader(createdBy, options?)`
- `updateMetadata(assetId, metadata, updatedBy)`
- `delete(assetId, deletedBy)`

All methods are backend-oriented service methods for module-to-module usage.
No HTTP controller is provided by default.

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
- `status` (`active | deleted`)
- `createdAt`, `createdBy`
- `updatedAt`, `updatedBy?`
- `deletedAt?`, `deletedBy?`

Purpose of key fields:
- `filename`: display/update-friendly logical name. Defaults to uploaded file original name if not provided.
- `storageKey`: S3 object key used for technical retrieval/deletion.
- `createdBy`: uploader user id.

## Public Service API

### Upload

```typescript
const asset = await this.assetService.upload({
  buffer: file.buffer,
  size: file.size,
  originalName: file.originalname,
}, userId, {
  path: 'project-attachments',
  prefix: 'ticket',
  access: EnumAssetAccess.private,
  filename: 'Flight Ticket - Jakarta to Tokyo.pdf',
  checksum: 'sha256:...'
});
```

Behavior:
1. Generates an S3 key.
2. Uploads bytes to S3.
3. Saves metadata into `Assets` table.
4. Returns created `Asset`.

### Metadata Update

```typescript
await this.assetService.updateMetadata(assetId, {
  filename: 'Updated Display Name.pdf',
}, userId);
```

### Delete

```typescript
await this.assetService.delete(assetId, userId);
```

Behavior:
1. Deletes object in S3.
2. Marks asset as soft-deleted in DB.

## How Other Modules Should Use It

Pattern:
1. Consumer module validates business rules (auth, permissions, project scope, ownership).
2. Consumer module calls `AssetService` for file lifecycle.
3. Consumer module stores any extra relation tables it needs (e.g., project linkage, access rules).

Important:
- `AssetModule` is opt-in and must be imported by each module that needs it.

Example module wiring:

```typescript
@Module({
  imports: [AssetModule],
  providers: [ProjectTransportService, ProjectTransportRepository],
})
export class ProjectTransportModule {}
```

Example injection:

```typescript
@Injectable()
export class ProjectTransportService {
  constructor(
    private readonly assetService: AssetService,
    private readonly projectTransportRepository: ProjectTransportRepository
  ) {}
}
```

## Basic Scenario: User Owns Multiple Assets

Use case:
- A user uploads multiple personal files.
- Ownership is simply the uploader (`createdBy`).

Example service flow:

```typescript
async uploadMyAsset(userId: string, file: IFile): Promise<Asset> {
  return this.assetService.upload({
    buffer: file.buffer,
    size: file.size,
    originalName: file.originalname,
  }, userId, {
    path: `users/${userId}`,
    prefix: 'profile-doc',
    access: EnumAssetAccess.private,
  });
}

async listMyAssets(userId: string): Promise<Asset[]> {
  return this.assetService.listByUploader(userId);
}
```

This is enough when your domain does not require sharing/project-level visibility yet.

## Standard Scenario: User Upload and User-to-User Share

Use case:
- A user uploads an asset.
- The uploader decides which specific users can access that asset.

Recommended approach:
1. Keep `AssetsModule` unchanged.
2. Add a sharing table in your own module, for example `UserAssetShare`.
3. Validate share permissions in your module before exposing asset metadata/download.

Example table shape (consumer module):

```ts
UserAssetShare {
  id
  assetId
  ownerUserId
  sharedWithUserId
  expiresAt?
  createdAt
  createdBy
}
```

Example flow:

```typescript
async uploadAndShare(
  uploaderId: string,
  file: IFile,
  sharedWithUserIds: string[]
): Promise<Asset> {
  const asset = await this.assetService.upload({
    buffer: file.buffer,
    size: file.size,
    originalName: file.originalname,
  }, uploaderId, {
    path: `users/${uploaderId}/shared`,
    access: EnumAssetAccess.private,
  });

  await this.userAssetShareRepository.createMany(
    sharedWithUserIds.map(sharedWithUserId => ({
      assetId: asset.id,
      ownerUserId: uploaderId,
      sharedWithUserId,
      createdBy: uploaderId,
    }))
  );

  return asset;
}
```

This keeps responsibilities clean:
- `AssetsModule` = storage lifecycle
- Consumer module = sharing and access rules

Rule:
- Any shared asset is read-only for shared users.
- Only `ownerUserId` can update metadata or delete the asset.

## Advanced Scenario (In Progress): Project and Member Access

Use case:
- Assets are attached to a project.
- Some assets are visible only to selected users.
- Other assets are visible to all active project members.

Recommended approach:
1. Keep `AssetsModule` unchanged.
2. Add your own domain tables in consumer module, for example `ProjectAssetAccess`.
3. Resolve access in your domain service before calling `assetService.getOne(...)` or returning presigned download data.

Example table shape (consumer module):

```ts
ProjectAssetAccess {
  id
  projectId
  assetId
  userId
  createdAt
  createdBy
}
```

Example access flow:

```typescript
async getProjectAssetForUser(
  projectId: string,
  assetId: string,
  actorUserId: string
): Promise<Asset> {
  // 1) Check actor is active project member (or tenant-admin override)
  await this.projectPermissionService.ensureCanReadProject(projectId, actorUserId);

  // 2) Check asset visibility from your own access table
  const canAccess = await this.projectAssetAccessRepository.canUserAccess({
    projectId,
    assetId,
    userId: actorUserId,
  });

  if (!canAccess) {
    throw new ForbiddenException('project.asset.error.forbidden');
  }

  // 3) Resolve metadata through AssetService
  return this.assetService.getOne(assetId);
}
```

This keeps responsibilities clean:
- `AssetsModule` = storage lifecycle
- Consumer module = business access model

Status:
- This project/member approach is still in progress and should be treated as a next-phase design.

## Design Guidelines

- Keep `AssetsModule` reusable and domain-neutral.
- Do not put project/tenant sharing logic into `AssetService`.
- Put authorization checks in guards/services of the consumer module.
- Store linkage/access tables near the domain that owns those rules.
- Use `filename` as human-friendly display name; users can rename it later.

## Important Notes

1. `AssetService` methods do not authorize who is allowed to call them.
2. `listByUploader` is a data helper; still enforce caller authorization at module level.
3. Soft-deleted assets should be excluded by default from domain queries unless explicitly needed.
4. If your feature requires public download links or presign flows, build that in your domain API layer and reuse stored asset metadata.


<!-- REFERENCES -->

[ref-doc-file-upload]: ./file-upload.md
[ref-doc-presign]: ./presign.md
[ref-doc-authorization]: ./authorization.md
[ref-doc-project]: ./project.md
[ref-doc-tenant]: ./tenant.md
