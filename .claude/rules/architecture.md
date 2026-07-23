# Architecture — repository pattern

Three roles, one reason to change each. Blurring them is the most expensive mistake available in this codebase.

```
Controller ──▶ Service ──▶ Repository ──▶ DatabaseService (Prisma)
```

## Repository

- **Data access ONLY.** Prisma queries, `select`, `where`, `orderBy`, pagination calls. No business rules, no HTTP concepts, no i18n.
- Injects `DatabaseService` directly as a class. No `@Inject`, no token, no interface — a repository has exactly one implementation and inventing a port for it is speculative abstraction.
- **The repository owns `null → {}` normalization** for filter params before they reach Prisma. Never in the caller. A service that spreads `filter ?? {}` into a repository call has taken over the repository's job.
- Returns Prisma models or the module's `I<Module>*` interfaces. It does not return DTOs.
- May inject `PaginationService`, `DatabaseUtil`, and other repositories' utils where the query genuinely needs them.

## Service

- **Business logic ONLY.** Orchestration, validation of rules, exception throwing, i18n message paths, composing repository calls.
- Injects repositories as classes. Injects other services as classes.
- **NEVER injects `DatabaseService`.** Data access goes through the repository, always. This is the single hardest rule in the file.
- **No header interface.** A service is injected by its class, so an `I<Module>Service` beside it is ceremony — see the header-interface rule in `rules/operational.md`.

## Controller

- **Route delegation ONLY.** One endpoint maps to one service method. Decorators, param extraction, and the return value — nothing else.
- Normalizes the input boundary: `undefined → null` before calling the service (`service.update(id, dto.bio ?? null)`). See `rules/null-safety.md`.
- No business rules, no repository access, no pagination metadata assembled by hand.

## SOLID, applied here

- **S** — the three roles above. A service method that builds a Prisma `where` has crossed into the repository; a repository that throws `UserNotFoundException` has crossed into the service.
- **O** — extend with a new class, strategy, or decorator. Never add an `if (type === 'x')` branch to stable code to make it handle one more case.
- **L** — a subclass or implementation must be drop-in for its base. No narrowing behavior, no surprise throws a caller cannot see coming.
- **I** — an interface is shaped by its CONSUMER, not by its implementor. An interface with no consumer is not a small interface; it is no interface at all (`rules/operational.md`).
- **D** — depend on an abstraction only where a real seam exists: a swappable strategy, or a shape more than one type satisfies. Services and repositories have neither, so they are injected as classes.

**DRY** — zero copy-paste logic. Written twice is a signal, written three times is a defect. One source of truth per config value, connection, and constant.

**KISS + YAGNI gate SOLID and DRY.** Resolve conflicts in this order: correctness and security first, then YAGNI + KISS (is structure needed at all?), then SOLID + DRY (shape the structure that survived). Duplication beats the wrong abstraction — do not abstract to satisfy DRY against YAGNI.

## Path aliases — relative imports are forbidden

```
@app/*  @common/*  @config  @configs/*  @modules/*  @queues/*
@routes/*  @router  @migration/*  @test/*  @generated/*  @package
```

`@prisma/client` resolves to `generated/prisma-client`. A `../` in an import is a defect, including inside the same module.

## Module wiring

- A feature module exports what other modules consume — normally its service, sometimes a guard-backing service. Internal helpers stay unexported.
- **Never `forwardRef` between feature modules.** That is a broken boundary to re-architect, not a hazard to work around.
- Shared infrastructure comes from `src/common/` via `CommonModule.forRoot()`. **Never open a second Redis connection** — share through the cache/queue modules that already own one.
- Controllers are registered by `src/router/routes/routes.<scope>.module.ts`, and BullMQ processors by `src/queues/queue.module.ts`. Registration is external; the files live in the feature module.

## `src/common/` IS the shared module

`src/common/` is the project's **shared module** — the one place cross-cutting, module-agnostic capability lives: database, cache, redis, pagination, request, response, logger, message, helper, file, doc, aws, firebase. `CommonModule.forRoot()` composes it and makes the global pieces available everywhere.

Being shared is exactly why it must stay thin. It is not a parking lot for anything that happens to be imported in several places.

- A shape with a natural owner module **stays in that module** and is imported across, however many modules import it. **A natural owner disqualifies promotion on its own — caller count is not the test.**
- Promote into `src/common/` only when the concept is genuinely module-agnostic (no natural owner) AND has three or more external callers.
- `src/common/` MAY import a feature module for composition (`common.module.ts` wiring) or a feature's compile-time enum. It MUST NOT import a feature's runtime code or bind a feature type as a generic default — a shared module that knows one feature's internals is no longer shared.
- A feature module NEVER re-implements what the shared module already provides. Reach for `HelperService`, `PaginationService`, `ResponseUtil`, `MessageService`, `DatabaseService` before writing your own.

## No backward compatibility — ever

No external client depends on this repo. **Breaking changes are the default, not the exception.**

- **A new feature carries NO backward-compatibility affordance.** No deprecated-but-kept field, no `v2` variant beside a `v1`, no optional flag preserving the old behavior, no adapter layer bridging old and new. Build the correct shape and change every call site.
- When an existing design is wrong, replace it. Never keep a worse design because something already uses it.
- **Best practice outranks the existing pattern.** Default to current community best practice for NestJS, Prisma, and TypeScript, and pick the clean shape over the incumbent one.
- Use existing code only as a divergence check: when best practice clashes HARD with an established pattern here, WARN the owner before applying — do not apply silently. Minor local divergence: just proceed.
