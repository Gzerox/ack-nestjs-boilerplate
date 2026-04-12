# Trip Form Integration

## Scope

This file documents how forms belong directly to trips with explicit `TripForm` models.

There is no separate trip-to-form bridge model in this approach. `TripForm` is the trip-scoped form record; `TenantFormTemplate` (new) is the tenant-owned reusable template.

## Related Documents

1. Trip domain (consolidated): [trip.md](trip.md)
2. Runtime form lifecycle: [../../form.md](../../form.md)
3. Trip traveler scope: [trip-traveler.md](trip-traveler.md)
4. Tenant form templates: _new module `src/modules/tenant-form-template/`_

## Prisma Schema

Trip-scoped form ownership model:

```prisma
model Trip {
  id        String @id @default(auto()) @map("_id") @db.ObjectId
  // ...

  forms     TripForm[]
}

model TenantFormTemplate {
  id               String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId         String   @db.ObjectId
  kind             EnumTripFormKind
  title            String
  description      String?
  isActive         Boolean  @default(true)
  templateSnapshot Json     // immutable snapshot of form structure

  tripForms        TripForm[] @relation("TripFormTemplate")

  createdAt DateTime @default(now())
  createdBy String   @db.ObjectId
  updatedAt DateTime @updatedAt
  updatedBy String?  @db.ObjectId

  @@index([tenantId, isActive])
  @@map("TenantFormTemplates")
}

model TripForm {
  id             String             @id @default(auto()) @map("_id") @db.ObjectId
  kind           EnumTripFormKind
  title          String
  description    String?
  status         EnumTripFormStatus @default(draft)
  schemaSnapshot Json
  closesAt       DateTime?
  publishedAt    DateTime?
  tripId         String             @db.ObjectId
  templateId     String?            @db.ObjectId

  sections    TripFormSection[]    @relation("TripFormSections")
  questions   TripFormQuestion[]   @relation("TripFormQuestions")
  assignments TripFormAssignment[] @relation("TripFormAssignments")
  trip        Trip                 @relation(fields: [tripId], references: [id], onDelete: Cascade)
  template    TenantFormTemplate?  @relation("TripFormTemplate", fields: [templateId], references: [id])

  createdAt DateTime @default(now())
  createdBy String   @db.ObjectId
  updatedAt DateTime @updatedAt
  updatedBy String?  @db.ObjectId
  deletedAt DateTime?
  deletedBy String?  @db.ObjectId

  @@index([createdBy, status])
  @@index([kind, status])
  @@index([publishedAt])
  @@index([closesAt])
  @@index([tripId])
  @@index([templateId])
  @@index([tripId, deletedAt])
  @@map("TripForms")
}

model TripFormSection {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  formId    String   @db.ObjectId
  label     String?
  position  Int
  createdAt DateTime @default(now())

  form      TripForm           @relation("TripFormSections", fields: [formId], references: [id], onDelete: Cascade)
  questions TripFormQuestion[] @relation("TripFormSectionQuestions")

  @@index([formId, position])
  @@map("TripFormSections")
}

model TripFormQuestion {
  id          String                   @id @default(auto()) @map("_id") @db.ObjectId
  formId      String                   @db.ObjectId
  sectionId   String                   @db.ObjectId
  type        EnumTripFormQuestionType
  label       String
  supportText String?
  placeholder String?
  required    Boolean
  position    Int
  validation  Json?
  options     Json?
  createdAt   DateTime                 @default(now())

  form    TripForm         @relation("TripFormQuestions", fields: [formId], references: [id], onDelete: Cascade)
  section TripFormSection  @relation("TripFormSectionQuestions", fields: [sectionId], references: [id], onDelete: Cascade)
  answers TripFormAnswer[] @relation("TripFormQuestionAnswers")

  @@index([formId, sectionId, position])
  @@index([formId, type])
  @@map("TripFormQuestions")
}

model TripFormAssignment {
  id          String                     @id @default(auto()) @map("_id") @db.ObjectId
  formId      String                     @db.ObjectId
  tripId      String                     @db.ObjectId
  userId      String                     @db.ObjectId
  required    Boolean                    @default(true)
  startsAt    DateTime?
  closesAt    DateTime?
  isActive    Boolean                    @default(true)
  status      EnumTripFormResponseStatus @default(pending)
  submittedAt DateTime?
  createdAt   DateTime                   @default(now())
  updatedAt   DateTime                   @updatedAt

  form    TripForm         @relation("TripFormAssignments", fields: [formId], references: [id], onDelete: Cascade)
  user    User             @relation("UserTripFormAssignments", fields: [userId], references: [id])
  answers TripFormAnswer[] @relation("TripFormAnswers")

  @@unique([formId, userId])
  @@index([tripId])
  @@index([formId, isActive])
  @@index([formId, status])
  @@index([userId])
  @@index([userId, formId])
  @@index([userId, isActive])
  @@index([userId, status])
  @@map("TripFormAssignments")
}

model TripFormAnswer {
  id           String    @id @default(auto()) @map("_id") @db.ObjectId
  formId       String    @db.ObjectId
  assignmentId String    @db.ObjectId
  questionId   String    @db.ObjectId
  numberValue  Float?
  optionValue  String?
  optionValues String[]
  textValue    String?
  booleanValue Boolean?
  dateValue    DateTime?

  assignment TripFormAssignment @relation("TripFormAnswers", fields: [assignmentId], references: [id], onDelete: Cascade)
  question   TripFormQuestion   @relation("TripFormQuestionAnswers", fields: [questionId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  createdBy String?  @db.ObjectId
  updatedAt DateTime @updatedAt
  updatedBy String?  @db.ObjectId

  @@unique([assignmentId, questionId])
  @@index([formId, questionId])
  @@map("TripFormAnswers")
}
```

## Entity Notes

1. **`TripForm`** belongs to exactly one trip through `tripId`.
2. **`Trip`** exposes `forms TripForm[]`.
3. There is no bridge table between `Trip` and `TripForm`.
4. **`TenantFormTemplate`** is tenant-owned and reusable across multiple trips.
5. **`TripForm`** may have a `templateId` (audit trail of which template was cloned).
6. **`TripFormAssignment`** is the per-user delivery record for a trip-owned form.
7. **`TripFormAssignment.tripId`** (added for efficiency) allows queries scoped to a specific trip without joining `TripForm`.
8. Cross-trip reuse can happen by:
   - Cloning from a `TenantFormTemplate` → `POST /trips/:idTrip/forms/from-template`
   - Creating a new `TripForm` from scratch → `POST /trips/:idTrip/forms`

## Controllers

Trip-scoped form endpoints (controllers at `@Controller('/trips')`):

### Admin / Shared Routes

- `POST /trips/:idTrip/forms` — create new draft form
- `POST /trips/:idTrip/forms/from-template` — clone from `TenantFormTemplate`
- `GET /trips/:idTrip/forms` — list forms for trip with status/kind filters
- `GET /trips/:idTrip/forms/:idForm` — get one form
- `PATCH /trips/:idTrip/forms/:idForm` — update draft
- `PATCH /trips/:idTrip/forms/:idForm/publish` — publish draft
- `POST /trips/:idTrip/forms/:idForm/assignments` — create assignment
- `PATCH /trips/:idTrip/forms/:idForm/archive` — archive form
- `DELETE /trips/:idTrip/forms/:idForm` — delete form
- `GET /trips/:idTrip/forms/:idForm/metrics` — get counts (`assignedCount`, `pendingCount`, `submittedCount`, `completionRate`)
- `GET /trips/:idTrip/forms/:idForm/responses` — list assignments and answers
- `GET /trips/:idTrip/forms/:idForm/questions/:questionId/summary` — aggregate answers

### User Routes

- `GET /trips/:idTrip/forms` — list user's assigned forms for trip
- `GET /trips/:idTrip/forms/:idForm/assignments/:assignmentId` — get form + user's assignment + answers
- `POST /trips/:idTrip/forms/:idForm/assignments/:assignmentId/submit` — submit answers

## DTOs

### `TripFormCreateDraftRequestDto`

```typescript
{
  kind: EnumTripFormKind         // 'survey' | 'form' | 'poll'
  title: string
  description?: string
  closesAt?: Date
  sections: TripFormSchemaSectionRequestDto[]
}
```

_Note: `tripId` comes from route param `idTrip`, not request body._

### `TripFormCreateFromTemplateRequestDto`

```typescript
{
  templateId: string    // TenantFormTemplate.id
  closesAt?: Date       // optional override
}
```

_Clones template's `templateSnapshot` into new `TripForm.schemaSnapshot`._

## Assignment Semantics

`TripFormAssignment` is the per-user delivery mechanism for trip-owned forms.

Responsibilities:

- **`Trip`**: ownership scope (aggregate root)
- **`TripForm`**: questionnaire definition for that trip
- **`TripFormAssignment`**: which specific user must answer and on what schedule
- **`TripFormAnswer`**: submitted values keyed by `assignmentId` and `questionId`

Scoping rules:

1. Creating a form under a trip does not automatically assign it to all travelers.
2. Assignments must target individual users via `userId`.
3. Assignment scheduling (`startsAt`, `closesAt`) is assignment-level.
4. User-facing submission is assignment-scoped; one final submission per assignment.
5. Direct `tripId` on `TripFormAssignment` enables efficient trip-scoped queries without joins.

## Validation Rules

1. `tripId` is always required and comes from route param.
2. A `TripForm` must always belong to one trip.
3. Draft updates are only allowed when `status = 'draft'`.
4. Publishing materializes `schemaSnapshot` into `TripFormSection` and `TripFormQuestion` records.
5. Assignments can only be created after form is published.
6. Reuse across trips must clone from `TenantFormTemplate` or create a new `TripForm`; one form record cannot belong to multiple trips.
7. Once assigned and submitted, an assignment cannot be submitted again.

## Authorization and Visibility

1. Shared form endpoints require: valid JWT + API key + enabled `trip` feature flag + active user check.
2. Ownership enforcement: all queries scoped to trip via route param `idTrip`.
3. Trip-scoped queries use `tripId` on `TripFormAssignment` directly (no join needed).
4. End-user endpoints enforce term policy acceptance before access.
5. User assignment list is scoped to the trip; only returns assignments for that specific trip.
