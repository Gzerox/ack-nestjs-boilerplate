# Trip Attachment Implementation

## Scope

This file owns trip-specific files, documents, and attachments:

1. `TripAttachment`

Attachments cover materials such as legal terms, policies, insurance files, and other trip-bound documentation.

## Related Documents

1. Directory index: [README.md](README.md)
2. Trip aggregate: [trip.md](trip.md)
3. Trip contact scope: [trip-contact.md](trip-contact.md)
4. Media scope: [trip-media.md](trip-media.md)

## Enumerations

```text
TripAttachmentType: TERMS_AND_CONDITIONS | PRIVACY_POLICY | INSURANCE |
                    VISA_REQUIREMENTS | HEALTH_REQUIREMENTS | OTHER
```

## Shared Embedded File Metadata

Trip attachments use the same embedded file metadata object shape as `UserPhoto` whenever a file is attached.

```prisma
type TripFileAsset {
  bucket       String
  key          String
  cdnUrl       String?
  completedUrl String
  mime         String
  extension    String
  access       String
  size         Int
}
```

## Prisma Draft Schema

```prisma
enum TripAttachmentType {
  TERMS_AND_CONDITIONS
  PRIVACY_POLICY
  INSURANCE
  VISA_REQUIREMENTS
  HEALTH_REQUIREMENTS
  OTHER
}

model TripAttachment {
  id              String              @id @default(uuid())
  tripId          String
  createdBy       String

  title           String
  type            TripAttachmentType  @default(OTHER)
  contentMarkdown String?             @db.Text
  file            TripFileAsset?
  displayName     String?
  required        Boolean             @default(false)

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  trip            Trip                @relation(fields: [tripId], references: [id], onDelete: Cascade)

  @@index([tripId])
}
```

## Entity Notes

1. `TripAttachment` is always scoped to one trip.
2. Attachments are manageable by backend users during trip creation and trip editing.
3. No standalone controller is expected for now.
4. `TripAttachment.type` is constrained to `TripAttachmentType`. Free strings are not accepted. The default value is `OTHER`.
5. The `Trip` model exposes `attachments TripAttachment[]`.
6. `createdBy` stores the `userId` of the authenticated caller who created the attachment record.

## Management Behavior

1. Attachments are created, updated, or removed through trip aggregate save flows.
2. A single attachment may contain an uploaded file, inline markdown content, or both, depending on the final product requirement.
3. `required = true` indicates material that the traveler is expected to review as part of the trip.

## Controllers

No dedicated controller is expected for now.

Backend users manage attachments through trip creation and edit operations.

## DTOs

### `TripAttachmentCreateRequestDto` (nested in `TripCreateDraftRequestDto` / `TripUpdateDraftRequestDto`)

- `title: string` — `@IsString @IsNotEmpty`
- `type: TripAttachmentType` — `@IsEnum(TripAttachmentType) @IsNotEmpty`
- `contentMarkdown?: string` — `@IsString @IsOptional`
- `file?: TripFileAssetDto` — `@ValidateNested @Type(() => TripFileAssetDto) @IsOptional`
- `displayName?: string` — `@IsString @IsOptional`
- `required: boolean` — `@IsBoolean @IsNotEmpty`

At least one of `contentMarkdown` or `file` should be non-null in normal usage. This constraint is enforced at the service layer, not the DTO level.

### `TripAttachmentResponseDto`

- `id: string`
- `tripId: string`
- `title: string`
- `type: TripAttachmentType`
- `contentMarkdown: string | null`
- `file: TripFileAssetDto | null`
- `displayName: string | null`
- `required: boolean`
- `createdAt: Date`
- `createdBy: string`

### `TripAttachmentPublicResponseDto`

Same fields as `TripAttachmentResponseDto`. This is a distinct class used in `TripUserResponseDto` as the extension point for future visibility restrictions (e.g., omitting `file` for certain types in customer-facing responses).

## Validation Rules

1. `tripId` is always required.
2. `title` is required.
3. At least one of `contentMarkdown` or `file` should be present in normal usage.
4. `type` must be a valid `TripAttachmentType` value.

## Authorization and Visibility

1. Backend users manage attachments through trip aggregate write access.
2. Customers receive attachments via `GET /user/trips/:idTrip` through the `TripAttachmentPublicResponseDto` shape.
