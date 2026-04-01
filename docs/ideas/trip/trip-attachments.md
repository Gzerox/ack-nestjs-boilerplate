# Trip Attachment Implementation

## Scope

This file owns trip-specific files, documents, and attachments:

1. `TripAttachment`

Attachments cover materials such as legal terms, policies, insurance files, and other trip-bound documentation.

## Related Documents

1. Directory index: [README.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/README.md)
2. Trip aggregate: [trip.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip.md)
3. Contact scope: [trip-contact.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-contact.md)
4. Media scope: [trip-media.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-media.md)

## Prisma Draft Schema

```prisma
model TripAttachment {
  id              String   @id @default(uuid())
  tripId          String
  title           String
  type            String?  @db.VarChar(64)
  contentMarkdown String?  @db.Text
  fileUrl         String?
  displayName     String?
  required        Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  trip            Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)

  @@index([tripId])
}
```

## Entity Notes

1. `TripAttachment` is always scoped to one trip.
2. Attachments are manageable by backend users during trip creation and trip editing.
3. No standalone controller is expected for now.
4. Attachment `type` should support legal or policy-oriented values such as terms and conditions, policy, and insurance.
5. The `Trip` model should expose `attachments TripAttachment[]`.

## Management Behavior

1. Attachments are created, updated, ordered, or removed through trip aggregate save flows.
2. A single attachment may contain uploaded file metadata, inline markdown content, or both, depending on the final product requirement.
3. `required = true` indicates material that the traveler is expected to review as part of the trip.

## Controllers

No dedicated controller is expected for now.

Backend users manage attachments through trip creation and edit operations.

## Validation Rules

1. `tripId` is always required.
2. `title` is required.
3. At least one of `contentMarkdown` or `fileUrl` should be present in normal usage.
4. `type` should be normalized during implementation to the supported attachment categories.

## Authorization and Visibility

1. Backend users manage attachments through trip aggregate write access.
2. End-user exposure can be defined in the trip detail contract once attachment visibility rules are finalized.
