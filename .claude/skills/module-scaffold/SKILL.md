---
name: module-scaffold
description: Create a new feature module under src/modules/ in ack-nestjs-boilerplate, or add a missing layer to an existing one. Use whenever the task is "add a new module", "scaffold <feature>", "create the <feature> module", or when a feature needs a folder set it does not yet have. It covers the folder tiers, the module file shape, controller registration in the router, status-code and i18n wiring, and the exports contract — all of which are easy to get subtly wrong and boot-breaking when you do.
---

# Scaffolding a feature module

Read `docs/project-structure.md` first. It is the source of truth for what each folder means; this skill is the procedure.

**Take only the folders the feature needs.** No module has all of them, and an empty folder kept "for later" is a YAGNI violation the reviewer rejects.

```
src/modules/<feature>/
  # Core — almost every module
  ├── constants/ · controllers/ · dtos/{request,response}/ · enums/
  ├── exceptions/ · interfaces/ · repositories/ · services/ · utils/
  # Common — when the feature needs them
  ├── decorators/ · docs/ · guards/
  # Specialized — a few modules only
  └── factories/ · indicators/ · interceptors/ · processors/ · templates/ · validations/
  └── <feature>.module.ts
```

## Procedure

### 1. The module file

`src/modules/<feature>/<feature>.module.ts`:

```ts
@Module({
    imports: [],
    exports: [<Feature>Service, <Feature>Repository],
    providers: [<Feature>Service, <Feature>Repository],
    controllers: [],
})
export class <Feature>Module {}
```

- **`controllers: []` stays empty.** Controllers are registered by the route layer, not by the feature module. Putting one here double-registers it.
- Export only what other modules consume. An internal helper stays unexported.
- **Never `forwardRef` to another feature module.** A cycle is a boundary to re-architect.
- One JSDoc line at the class level if it adds anything; nothing if the name says it all (`rules/operational.md`).

### 2. Repository

`repositories/<feature>.repository.ts` — injects `DatabaseService` directly as a class, plus `PaginationService` and `DatabaseUtil` where the queries need them. No interface, no token. Data access only; it owns `null → {}` filter normalization.

### 3. Service

`services/<feature>.service.ts`. It injects the repository as a class and **never** `DatabaseService`.

**Do NOT create a `<feature>.service.interface.ts`.** A service is injected by its class, so a header interface beside it has no consumer and is ceremony (`rules/operational.md`). `interfaces/` holds data shapes only — `I<Feature>`, payload types, option bags.

### 4. Status codes, exceptions, i18n

- Claim a numeric block and create `enums/<feature>.status-code.enum.ts` — **use the `status-code` skill**, do not pick a number by hand.
- One exception class per file in `exceptions/`.
- Create `src/languages/<lang>/<feature>.json` with nested keys for every `messagePath`, in **every** language directory.

### 5. Controllers and the router

- Name each controller for its scope: `controllers/<feature>.<scope>.controller.ts`, `<scope>` ∈ `admin` · `public` · `user` · `system` · `shared`.
- Register it in the matching `src/router/routes/routes.<scope>.module.ts`: add the controller to `controllers:` and the feature module to `imports:`.
- Add the matching Swagger factories in `docs/<feature>.<scope>.doc.ts`, and any `@ApiQuery` / `@ApiParam` arrays as PascalCase constants in `constants/<feature>.doc.constant.ts`.
- The protection decorator stack is exact — `rules/http.md`.

### 6. DTOs

- `dtos/request/<feature>.<action>.request.dto.ts` — `class-validator` + `@ApiProperty` on every field.
- `dtos/response/<feature>.<action>.response.dto.ts` — **`@Expose()` on every field you intend to return**, plus `@Type()` on every nested DTO. A field without `@Expose()` silently does not appear.

### 7. Processors (only if the feature has async work)

`processors/<feature>.<concern>.processor.ts` extending `QueueProcessorBase`, decorated with `@QueueProcessor(EnumQueue.<name>)`. Then:

- Add the queue to `EnumQueue` in `src/queues/enums/queue.enum.ts`.
- Register it in `src/queues/queue.register.module.ts` (`BullModule.registerQueue`).
- Provide the processor class in `src/queues/queue.module.ts` and import the feature module there.

Registration is external; the file lives in the feature module. See `rules/queue.md`.

### 8. Global wiring (only if the module is genuinely cross-cutting)

A module needed by guards or by most other modules is imported in `src/common/common.module.ts`'s `forRoot()`. **Most feature modules do NOT belong there** — being imported by three modules is not the same as being infrastructure. If in doubt, wire it through the route module and leave `common.module.ts` alone.

### 9. Seeds (only if the module needs initial data)

Add the seeder under `src/migration/seeds/` with its data in `src/migration/data/`, then tell the owner to run `pnpm migration <feature> --type seed`. **Do not run migration commands yourself** (`rules/database.md`).

## Before you call it done

- `pnpm typecheck` · `pnpm lint` · `pnpm spell`
- Specs written first, mirrored under `test/modules/<feature>/`, green at 100% for the covered file kinds (`rules/testing.md`). Controllers and repositories are outside the coverage set.
- `pnpm start:dev` boots. **A new module is the single most likely thing to introduce a DI or import cycle, and a cycle surfaces only at boot** — `tsc` and jest both stay green through one.
- `docs/project-structure.md` names the new module in its module list. That is a doc claim your change just made stale: report it for the `doc-drift` agent rather than editing the doc yourself.
