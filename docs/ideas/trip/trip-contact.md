# Trip Contact Implementation

## Scope

This file owns the support-contact side of the Trip domain:

1. `TenantContact`
2. `TripContact`

These entities provide assistance and support points of reference for travelers.

## Related Documents

1. Directory index: [README.md](README.md)
2. Trip aggregate: [trip.md](trip.md)
3. Media scope: [trip-media.md](trip-media.md)
4. Attachment scope: [trip-attachments.md](trip-attachments.md)

## Domain Model

1. `TenantContact` is the tenant-scoped contact book. It stores every contact ever added for a given tenant.
2. `TripContact` is the link table between `Trip` and `TenantContact`.
3. `TripContact` is used to expose support and assistance references inside trip details shown to travelers.

## Prisma Draft Schema

```prisma
model TenantContact {
  id          String        @id @default(uuid())
  tenantId    String
  createdBy   String

  firstName   String
  lastName    String
  category    String?       @db.VarChar(80)
  phoneE164   String?       @db.VarChar(32)
  email       String?       @db.VarChar(320)
  notes       String?       @db.Text

  deletedAt   DateTime?
  deletedBy   String?

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  trips       TripContact[]

  @@index([tenantId])
  @@index([tenantId, deletedAt])
}

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

1. Every `TenantContact` belongs to exactly one tenant.
2. `TenantContact` is reusable across many trips in the same tenant.
3. `DELETE /shared/contacts/:idContact` is a soft-delete; the schema includes `deletedAt` and `deletedBy`.
4. `TripContact` must only link a trip to contacts in the same tenant.
5. `POST /shared/trips` receives contacts as a list of existing `TenantContact` `ObjectId` values.
6. The service creates `TripContact[]` internally from that contact id list.
7. The `Trip` model exposes `contacts TripContact[]` on the aggregate root.
8. `createdBy` stores the `userId` of the authenticated caller who created the contact record.

## Service Interface

### `ITenantContactService`

File: `src/modules/trip/interfaces/tenant-contact.service.interface.ts`

```typescript
export interface ITenantContactService {
    create(
        dto: TenantContactCreateRequestDto,
        tenantId: string,
        createdBy: string
    ): Promise<IResponseReturn<TenantContactResponseDto>>;

    update(
        contactId: string,
        dto: TenantContactUpdateRequestDto,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<TenantContactResponseDto>>;

    softDelete(
        contactId: string,
        tenantId: string,
        deletedBy: string
    ): Promise<IResponseReturn<void>>;

    getList(
        tenantId: string,
        pagination: IPaginationQueryOffsetParams<Prisma.TenantContactSelect, Prisma.TenantContactWhereInput>
    ): Promise<IResponsePagingReturn<TenantContactResponseDto>>;

    getById(
        contactId: string,
        tenantId: string
    ): Promise<IResponseReturn<TenantContactResponseDto>>;
}
```

`TenantContactService implements ITenantContactService` is declared as a provider inside `TripModule` and exported so the router layer can satisfy its dependencies when `TripContactSharedController` is registered.

## Pagination Constants

File: `src/modules/trip/constants/tenant-contact.constant.ts`

```typescript
export const TenantContactDefaultAvailableSearch = ['firstName', 'lastName', 'email', 'category'];
export const TenantContactDefaultAvailableSort   = ['createdAt', 'firstName', 'lastName'];
export const TenantContactDefaultSort            = 'createdAt';
export const TenantContactDefaultPerPage         = 20;
```

## DTOs

### Request DTOs

#### `TenantContactCreateRequestDto`

- `firstName: string` — `@IsString @IsNotEmpty`
- `lastName: string` — `@IsString @IsNotEmpty`
- `category?: string` — `@IsString @IsOptional` max 80 chars
- `phoneE164?: string` — `@IsString @IsOptional` max 32 chars
- `email?: string` — `@IsEmail @IsOptional`
- `notes?: string` — `@IsString @IsOptional`

`tenantId` is **never** accepted from the client. It always comes from the authenticated context.

#### `TenantContactUpdateRequestDto`

All fields from `TenantContactCreateRequestDto`, all `@IsOptional`.

### Response DTOs

#### `TenantContactResponseDto extends DatabaseDto`

- `id: string`
- `tenantId: string`
- `firstName: string`
- `lastName: string`
- `category: string | null`
- `phoneE164: string | null`
- `email: string | null`
- `notes: string | null`
- `deletedAt: Date | null`
- `deletedBy: string | null`

#### `TripContactResponseDto` (embedded in `TripResponseDto` and `TripUserResponseDto`)

- `id: string` (TripContact id)
- `contact: TenantContactResponseDto`

## Controllers

### `TripContactSharedController`

Path prefix: `/shared/contacts`

Backend-user management endpoints:

#### `GET /shared/contacts`

List all contacts for the current tenant.

Tenant scope comes from `x-tenant-id` for now and must only return non-deleted contacts belonging to that tenant. Soft-deleted contacts (`deletedAt IS NOT NULL`) are always excluded.

Supported query parameters:
- `search` — matched against `firstName`, `lastName`, `email`, `category`
- `orderBy` — one of `createdAt`, `firstName`, `lastName` (default: `createdAt`)
- `perPage`, `page`

```typescript
@TripContactSharedListDoc()
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@ResponsePaging('tenantContact.list')
@Get('/')
async list(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @PaginationOffsetQuery() pagination: IPaginationQueryOffsetParams,
): Promise<IResponsePagingReturn<TenantContactResponseDto>>
```

#### `GET /shared/contacts/:idContact`

Return the full detail of one non-deleted contact.

The service must verify the contact belongs to the current tenant. Soft-deleted contacts return `404 NotFoundException` with `EnumTenantContactStatusCodeError.notFound`.

```typescript
@TripContactSharedGetDoc()
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('tenantContact.get')
@Get('/:idContact')
async get(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Param('idContact', RequestIsValidObjectIdPipe, RequestRequiredPipe) contactId: string,
): Promise<IResponseReturn<TenantContactResponseDto>>
```

#### `POST /shared/contacts`

Create a new contact for the current tenant.

`tenantId` must come from `x-tenant-id`, not from the client payload.
The response includes the created contact id so the client can reuse it in `POST /shared/trips`.

```typescript
@TripContactSharedCreateDoc()
@ActivityLog(EnumActivityLogAction.adminTenantContactCreate)
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('tenantContact.create')
@HttpCode(HttpStatus.CREATED)
@Post('/')
async create(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Body() body: TenantContactCreateRequestDto,
): Promise<IResponseReturn<TenantContactResponseDto>>
```

#### `PUT /shared/contacts/:idContact`

Update an existing contact.

The service must first verify that the contact belongs to the current tenant.

```typescript
@TripContactSharedUpdateDoc()
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('tenantContact.update')
@Put('/:idContact')
async update(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Param('idContact', RequestIsValidObjectIdPipe, RequestRequiredPipe) contactId: string,
    @Body() body: TenantContactUpdateRequestDto,
): Promise<IResponseReturn<TenantContactResponseDto>>
```

#### `DELETE /shared/contacts/:idContact`

Soft-delete an existing contact by setting `deletedAt` and `deletedBy`.

The service must first verify that the contact belongs to the current tenant.

```typescript
@TripContactSharedDeleteDoc()
@ActivityLog(EnumActivityLogAction.adminTenantContactDelete)
@UserProtected()
@AuthJwtAccessProtected()
@FeatureFlagProtected('trip')
@ApiKeyProtected()
@Response('tenantContact.delete')
@HttpCode(HttpStatus.OK)
@Delete('/:idContact')
async softDelete(
    @AuthJwtPayload() payload: IAuthJwtPayload,
    @Param('idContact', RequestIsValidObjectIdPipe, RequestRequiredPipe) contactId: string,
): Promise<IResponseReturn<void>>
```

## Tenant Access

1. Every management endpoint must verify that the caller has access to the tenant identified by `x-tenant-id`.
2. A future implementation may leverage the Tenant Decorator once it is available on the target branch.
3. This section should be updated once the Tenant Decorator contract is finalized.

## End-user Surface

There are no dedicated end-user contact endpoints.

Traveler clients receive trip contacts through:

1. `GET /user/trips/:idTrip` (embedded in `TripUserResponseDto.contacts`)

## Validation Rules

1. `TenantContact.tenantId` always comes from trusted context, never from client payload.
2. Soft-deleted contacts must be excluded from standard list results.
3. `TripContact` must not connect a trip to a `TenantContact` owned by another tenant.
4. Duplicate trip-contact links must be prevented by `(tripId, contactId)`.
5. `POST /shared/trips` contact ids must all belong to `TenantContact` records visible in the current tenant (non-deleted).

## Authorization and Visibility

1. Shared contact management is backend-user only.
2. All reads and writes are tenant-scoped.
3. End users only see contacts through trips they are allowed to access.
