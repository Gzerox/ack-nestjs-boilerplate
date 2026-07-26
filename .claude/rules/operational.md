# Code style & operational rules

## NestJS idiomatic — no hand-rolled substitutes

Use the framework the Nest way: modules, DI, providers, guards, pipes, interceptors, decorators, lifecycle hooks. If Nest already provides it, a hand-rolled version is a defect regardless of how well it works. No service locator, no manual instantiation of an injectable, no bare `@UseGuards` where a `@<Feature>Protected()` decorator is the convention.

## No header interfaces (HARD)

**A service does NOT get a header interface.** An `I<Xxx>Service` whose only implementor sits beside it, and which no consumer injects or types anything by, is ceremony: it restates the class's public surface with nothing forcing the two to move together, so it drifts silently and the class stays the real contract either way.

An interface earns its place exactly two ways:

1. **A data shape** — `IUser`, `IRequestLog`, `INotificationSendPushPayload`, `IPaginationQuery`. It describes data, not behavior, and many places consume it.
2. **A real seam** — a contract with more than one implementor, or one injected through a DI token because the concrete type is genuinely swappable. That is rare here; direct class injection is the norm.

A framework lifecycle contract that the framework itself consumes (`OnModuleInit`, `OnModuleDestroy`, `NestMiddleware`, `PipeTransform`, `CanActivate`, `ExceptionFilter`, `NestInterceptor`) is neither of those and is **required**, not optional. Keep those.

**The test is the consumer, not the layer:** if deleting the interface and its `implements` clause leaves every call site compiling unchanged, it was never a contract. Delete it — do not relocate it, do not merge it into another file, do not "keep it for documentation".

This applies in `src/common/`, `src/app/`, `src/queues/`, and feature modules alike.

> **Live state:** the repo currently carries 25 `*.service.interface.ts` files and 27 `implements I*Service` clauses, and **zero** injections typed by any of them — every service is injected as its concrete class. Under this rule they are all deletable. Removing them is a separate task the owner schedules; do not delete them as a side effect of an unrelated change, and do not add a new one.

## Two comment forms, and only two

There is exactly one place for prose about a symbol (a JSDoc block above it) and exactly one place for prose about a line (`// @note`). Anything else is noise.

| Form | Where it goes | How often |
|---|---|---|
| JSDoc block | above every method | ALWAYS |
| `// @note <text>` | own line, above the line it explains | VERY RARE |

## JSDoc — required on every method

**Every method carries a JSDoc block. Public and private, every folder, no exception** — including `controllers/`, `docs/` (`*.doc.ts`), `repositories/`, and `services/`. The old per-folder ban is gone: a role being obvious from the folder does not tell a reader what THIS method does.

Terse is still the standard. Required does not mean verbose.

- **One or two lines. Never more.** WHAT it does, plus a non-obvious WHY when there is one (a security reason, a tricky invariant, a deliberate deviation, a notable throw condition).
- **Do not restate the signature.** `getUserById` does not need "gets a user by id" — say what a reader cannot see: which exception it throws, what it excludes, what it assumes. If the honest sentence really is a restatement, write it anyway and keep it to one line.
- Always ABOVE the symbol. When the symbol is decorated, JSDoc goes above the FIRST decorator — never between a decorator and the declaration.
- **Banned tags:** `@example` `@param` `@returns` `@template` `@throws` `@private` `@export` `@class` `@implements` `@constraint` `@remarks`. They restate the signature. Fold anything worth keeping into the prose sentence.
- **Interfaces get NO JSDoc at all**, including per-field comments. This covers data shapes, payloads, and option bags. An interface has no methods to document; a genuinely critical invariant becomes one `// @note` line.
- **Modules with `forRoot()` / `forRootAsync()`:** document the module once at the class level; never the `forRoot` method separately. This is the one method that is exempt.
- **Constants:** at most one line, only when the value's rationale is non-obvious (a limit tied to an external cap). DI tokens and self-evident names get none. **Enums:** only when a value's meaning is non-obvious.
- **DTOs:** a one-line class JSDoc if it helps. Fields already covered by `@ApiProperty` need none.

## `// @note` — the only line comment, and it should be rare

A `@note` marks something a reader would otherwise get wrong: a tricky invariant, a security reason, a deliberate deviation, a framework constraint that looks like a mistake. It is not a place to narrate.

- **Every line comment is `// @note <text>`.** A bare `//` explanation is not a form this codebase has.
- **Reaching for `@note` often means the JSDoc should have carried it.** If the note explains the method rather than one line inside it, fold it into the method's JSDoc block and delete the note.
- **Never** explain a cast, a type subset, an obvious call, or what the next line does. When in doubt, leave it out.
- **No trailing comments.** Never place `//` to the right of code.
- `TODO` / `FIXME` keep their own prefixes and are for their canonical purpose only.
- **Preserve an existing rule-compliant comment verbatim** during a refactor. It moves with its code; delete it only when its subject is provably gone, and never rephrase it.

## Logging

- `private readonly logger = new Logger(ClassName.name);`
- **Errors are object-first:** `logger.error(error, 'Failed to connect')`. `debug` / `log` / `warn` are message-first.
- Pino redacts known secret keys automatically. Never rely on it — do not log a secret in the first place.

## Config

- Every `src/configs/*.config.ts` exports a TypeScript interface alongside its `registerAs`. Read `docs/configuration.md` and `docs/environment.md` before adding a key.
- Read config through `ConfigService.get('namespace.key')`. **Never `process.env` directly** in application code. The one sanctioned exception is a decorator factory, where DI is not available at decoration time (`@QueueProcessor`'s worker name) — and that exception is already taken; do not extend it.
- A new env var needs the config file, the interface, `.env.example`, and `docs/environment.md`.
- **A config-worthy value lives in a config file, not inline.** A TTL, a retry/backoff count, a memory or size threshold, a rollout percent, a CORS max-age, or a cron pattern hardcoded in a service, util, controller, guard, or module wiring is config in the wrong place. A bare `const` is not an escape hatch — promote it unless it is a genuinely fixed, single-source-of-truth invariant with no env knob today (YAGNI).
- **Every time value in config is milliseconds — no exceptions.** Field suffix is `InMs`, value is `ms('<string>')` with a string literal (`ms('182d')`, `ms('30s')`) — never a raw number (`30`), never inline arithmetic (`5 * 60 * 1000`, `30 * 60`), never a unit in a trailing comment, and never an `InSeconds` / `InMinutes` / `InDay` field. Config has exactly one time unit. **The conversion lives in the CONSUMER, not the config.** Where a third-party package wants another unit, convert at the call site: `Math.floor(x / 1000)` for seconds (jsonwebtoken `expiresIn`, AWS presign, otplib TOTP period), `x / ms('1d')` for a days count. Where the package already takes ms (cache-manager / Keyv TTL, BullMQ `backoff.delay`), pass the value straight through. A `/1000` inside a config file is the defect — move it out.
- **Size in config uses the smallest unit and `bytes()`.** Field suffix is `InBytes`, value is `bytes('500kb')` — never a raw byte count and never `n * 1024 * 1024`.

## Cache

Redis `db:0` is the cache, `db:1` is BullMQ. Both go through the modules that already own the connection — **never open a second Redis connection**. Cache a response with `@Response('key', { cache: … })`; see `docs/cache.md`.

## Documentation prose (`docs/*.md`)

- **No em-dash (`—`) in documentation prose.** Use a period, comma, semicolon, colon, or parentheses. Plain hyphens in compound words (`dev-mode`, `in-memory`) are fine; do not overuse them. The one exception is an existing structured list whose every entry already uses `—` as a separator: match it rather than breaking the pattern on one line.
- Simple, firm, and pointed. Bullets first, prose where prose is needed. Keep the existing section structure intact rather than reorganizing around a small correction.
