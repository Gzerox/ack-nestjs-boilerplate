# Database — Prisma + MongoDB

Setup, seeding, and composite types are in `docs/database.md`. This file is the code rule set.

## Access

- **ALWAYS inject `DatabaseService`; never `PrismaClient` directly.** `DatabaseService extends PrismaClient`, so the rule buys ONE injection point — logging, health check, and lifecycle are wired there once and every caller gets the same client.
- **Only repositories inject `DatabaseService`.** A service that injects it has bypassed the repository layer, and that is the single most consequential violation in this codebase (`rules/architecture.md`).
- `DatabaseModule` is global via `CommonModule.forRoot()`. A feature module does not import it.
- `DatabaseUtil` (`src/common/database/utils/database.util.ts`) holds the Mongo `ObjectId` helpers. Use it rather than hand-rolling id validation.

## Queries

- Prisma builder only. No `$queryRaw` / `$executeRaw` in a feature repository — a raw query is invisible to the type system and to any future database switch.
- `select` shapes belong in `<module>/constants/<module>.constant.ts` as PascalCase constants, so a schema change surfaces as a compile error at one place rather than silently returning fewer fields.
- Prefer one generic repository method with a discriminator param over a near-duplicate method per variant (OCP).
- **The repository owns `null → {}` normalization** of filter params before they reach Prisma. A caller that does it has taken the repository's job.

## Transactions

MongoDB transactions require the replica set — that is why `docker-compose` runs one. Two forms:

- **Array form** for a simple sequential batch with no branching: `databaseService.$transaction([opA, opB])`.
- **Callback form** when the work has conditional logic, needs a read between writes, or must branch on an intermediate result: `databaseService.$transaction(async tx => { … })`.

Using the array form for conditional logic is the failure here — the operations are built before any of them runs, so a decision that depends on an earlier write cannot exist.

Transactions live in the repository. A service does not open one.

## Schema is off-limits

- **Do NOT edit `prisma/schema.prisma`.** Describe the change; the owner applies it.
- **Do NOT run schema or DB commands** — `db:migrate`, `db:push`, `db:generate`, `migration:*`. Even `db:generate` regenerates a client the owner may not want regenerated mid-task.
- Prisma-owned enums are imported from `@generated/prisma-client` (aliased as `@prisma/client`). A module-local re-declaration of a schema-owned enum is a second source of truth with a pointless mapper between two identical enums.
- Renaming a persisted enum value is a data migration, not a rename. Describe it.

## Dates

Use `HelperService`'s date helpers rather than raw `new Date()` in business logic. They normalize consistently and give one mockable clock; a scattered `new Date()` is untestable and timezone-fragile. `TZ=UTC` in the test script exists because of this.
