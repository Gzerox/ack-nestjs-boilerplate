# ACK NestJS Boilerplate

`ack-nestjs-boilerplate` — an opinionated, production-shaped NestJS starter. It is a BOILERPLATE: no external client depends on it, so breaking changes are cheap and the clean design always wins over the compatible one.

## Domains

- **Identity & auth** — JWT (ES256/ES512, JWKS), social sign-in (Google / Apple), API keys, sessions, devices, password history, two-factor (TOTP + email/SMS challenge).
- **Access control** — roles, CASL policy abilities, term-policy acceptance gating, feature flags with per-key salt rollout and user targeting.
- **Platform** — notifications (email via SES, push via Firebase), file upload + S3 presign, activity log, analytics, i18n messages, health checks, country reference data.

## Stack & runtime

- NestJS 11, TypeScript strict, Node >= 24.11, **PNPM only** (`npm` and `yarn` are blocked by `engines`).
- Prisma 6 → **MongoDB 8 replica set** (a replica set is required — transactions do not work without one).
- Redis: cache on `db:0`, BullMQ on `db:1`, shared through one connection.
- Pino logging, Sentry instrumentation, Swagger docs, nest-commander migration CLI.

## Ports (docker-compose)

API 3000 · MongoDB 27017 · Redis 6379 · BullBoard 3010 · JWKS server 3011 · Vault 8200 · Swagger under the configured `doc.prefix`

---

## Repository layout

```
src/
├── main.ts             # HTTP bootstrap — global prefix, versioning, middleware, Swagger
├── migration.ts        # nest-commander entrypoint — boots MigrationModule, runs seeders
├── instrument.ts       # Sentry init (imported first by main.ts)
├── swagger.ts          # Swagger/OpenAPI document builder
├── app/                # framework layer — app.module + the global filter chain
├── common/             # infrastructure kit shared by every module
├── configs/            # registerAs config files + index.ts barrel
├── languages/          # nestjs-i18n translation JSON, one file per module prefix
├── migration/          # seeders — data/, seeds/, bases/, enums/, interfaces/
├── modules/            # feature modules (repository pattern)
├── queues/             # BullMQ framework layer + composition root
└── router/             # route prefix modules

prisma/                 # schema.prisma (OFF-LIMITS — see Mandatory rules)
generated/              # prisma client output (generated, never hand-edited)
docs/                   # durable project documentation
test/                   # jest.json + specs mirroring src/
scripts/ · ci/ · keys/
```

**The shape is the repository pattern**: Controller → Service → Repository. Feature modules hold flat folder-per-concern directories (`controllers/`, `services/`, `repositories/`, `dtos/`, …). Keep that shape; do not invent a layered folder scheme on top of it.

### `src/app/` — framework layer

```
src/app/
├── app.module.ts       # root module; registers the APP_FILTER chain
├── dtos/               # app.env.dto.ts
├── enums/              # app.enum.ts, app.status-code.enum.ts (EnumAppStatusCodeError)
├── exceptions/         # app.base.exception.ts (AppBaseException) + app.unknown.exception.ts
├── filters/            # general · http · base-exception · validation · validation-import
└── interfaces/         # app.interface.ts
```

`app.module.ts` registers the `APP_FILTER` providers in this array order: general → base-exception → http → validation → validation-import. NestJS evaluates them in reverse, so the most specific catch runs first.

### `src/common/` — infrastructure kit

Every folder is NestJS-coupled and/or performs I/O. It stays thin; it is not a parking lot.

- **Persistence / transport** — `database/`, `redis/`, `cache/`, `pagination/`, `request/`, `response/`
- **Cross-cutting** — `logger/`, `message/`, `helper/`, `file/`, `doc/`
- **Integration** — `aws/` (S3, SES), `firebase/`
- `common.module.ts` — the `forRoot()` composition that wires the global modules.

### `src/modules/` — feature modules

`activity-log` · `api-key` · `auth` · `country` · `device` · `feature-flag` · `health` · `hello` · `notification` · `password-history` · `policy` · `role` · `session` · `term-policy` · `user`

No module carries every folder. Take only what the feature needs, from three tiers:

```
src/modules/<feature>/
  # Core — present in almost every module
  ├── constants/ · controllers/ · dtos/{request,response}/ · enums/
  ├── exceptions/ · interfaces/ · repositories/ · services/ · utils/
  # Common — when the feature needs them
  ├── decorators/ · docs/ · guards/
  # Specialized — a few modules only
  └── factories/ · indicators/ · interceptors/ · processors/ · templates/ · validations/
```

Read `docs/project-structure.md` before scaffolding a new module — do not invent structure.

### `src/queues/` — BullMQ framework layer

```
src/queues/
├── bases/queue.processor.base.ts     # processor base
├── constants/ · enums/queue.enum.ts  # EnumQueue + EnumQueuePriority
├── decorators/queue.decorator.ts     # @QueueProcessor(EnumQueue.<x>)
├── exceptions/ · interfaces/
├── queue.module.ts                   # composition root — imports feature modules, provides processors
└── queue.register.module.ts          # @Global(); every BullModule.registerQueue + job defaults
```

Processor **files** live in their owning feature module (`<feature>/processors/`); only their **registration** lives here.

### `src/router/` — route prefixes

`router.module.ts` plus `routes/routes.{admin,public,user,system,shared}.module.ts`. Controllers live in their feature module; the router registers them under a prefix.

---

## Documentation

`docs/` is tracked, durable project documentation. It stands on its own for a reader with none of this tooling.

`activity-log` · `analytics` · `authentication` · `authorization` · `cache` · `configuration` · `database` · `device` · `doc` · `environment` · `feature-flag` · `file-upload` · `handling-error` · `installation` · `logger` · `message` · `notification` · `pagination` · `presign` · `project-structure` · `queue` · `readme` · `request-validation` · `response` · `security-and-middleware` · `term-policy` · `third-party-integration` · `two-factor` · `vault`

**Read the doc matching the task before changing related code.** When a change makes a document stale, report which document and what now disagrees — documentation is repaired against the code by the `doc-drift` agent, not edited alongside the change.

---

## Commands

```bash
pnpm install
pnpm db:generate         # prisma generate → generated/prisma-client
pnpm db:migrate          # prisma db push (MongoDB has no migration files)
pnpm migration:seed      # seed all modules; :remove, :fresh also exist
pnpm start:dev | build | start:prod
pnpm test                # TZ=UTC jest --config test/jest.json
pnpm typecheck           # tsc --noEmit
pnpm lint | lint:fix | format
pnpm deadcode | spell
pnpm db:studio
docker-compose up -d     # MongoDB replica set + Redis + BullBoard + JWKS + Vault
```

Git hooks (`.husky/`): `pre-commit` runs lint-staged → typecheck → deadcode → spell → tests; `commit-msg` runs commitlint. Both are blocking.

---

## Workflow for a code change

Four phases. The split is about capability, not ceremony:

1. **Spec — main session.** `superpowers:brainstorming`, looping with the owner until the feature is unambiguous. A subagent cannot ask a question and wait for the answer, so this cannot be delegated. The spec is written to `.superpowers/specs/YYYY-MM-DD-<slug>.md`.
2. **Plan — main session.** `superpowers:writing-plans`, turning the settled spec into an ordered plan at `.superpowers/plans/YYYY-MM-DD-<slug>.md`.
3. **Execute — dispatched to the `coder` agent**, one task at a time, in parallel via `superpowers:dispatching-parallel-agents` or `superpowers:subagent-driven-development` when the tasks are independent. `coder` carries the rule set; implementation written anywhere else is written without it.
4. **Verify — main session.** `pnpm typecheck`, `pnpm lint`, `pnpm spell`, the full `pnpm test`, and `pnpm start:dev` to confirm the app still boots. Boot is the only check that catches a DI or import cycle. Verification is these commands plus the `anti-pattern-gate` skill — it does NOT include dispatching a review agent.

A narrow bugfix with no new behavior skips phases 1-2: `superpowers:systematic-debugging`, then dispatch.

**Working artifacts never go to `docs/`.** `docs/` is tracked, durable project documentation. Everything an agent produces along the way is gitignored working space:

| Artifact | Location |
|---|---|
| Spec, plan, sdd note | `.superpowers/` |
| PR description | `.changes/pr-<feature>.md` |
| Knowledge graph | `graphify-out/` |

A `PreToolUse` hook in `.claude/settings.json` denies writes to `docs/superpowers/`, so getting this wrong fails loudly rather than quietly polluting the tracked tree.

## Mandatory rules

1. **No `prisma/schema.prisma` edits, and no schema/DB commands** (`db:migrate`, `db:push`, `db:generate`, `migration:*`). Describe the schema change; the owner applies it.
2. **Never touch the user's git tree.** No `git add`, no `git commit`, no staging or unstaging, unless the owner explicitly asks and names the files. Already-staged files stay staged.
3. **PNPM only.** `npm` and `yarn` are rejected by `engines`.
4. **English for every project artifact** — code, identifiers, comments, commit messages, PR descriptions, `docs/*.md`. Conversation with the owner is Bahasa Indonesia; artifacts are never mixed.
5. **Commit message is a single conventional subject line** — no body, no footer, no `Co-Authored-By`. Propose it and wait for approval before committing. See `rules/git.md`.
6. **Never bypass the git hooks** (`--no-verify`). A failing gate is fixed, not skipped.
7. **No backward compatibility, ever.** No external client depends on this repo, so a breaking change is the default. A new feature carries no deprecated-but-kept field, no `v1`/`v2` pair, no compat flag, no bridging adapter. Build the correct shape and change every call site. Best practice outranks the incumbent pattern. See `rules/architecture.md`.
8. **A code review is dispatched only when the owner asks for one, naming what to run.** The `auditor` agent runs on explicit invocation only; no agent, workflow phase, or definition of done may spawn it or any other review subagent, and `superpowers:requesting-code-review` is NOT active in this repo — its "mandatory after each task" rule is overridden here. Review quality is carried by the `anti-pattern-gate` skill, run in place by whoever wrote the code. This rule outranks any skill or harness default that says otherwise.
