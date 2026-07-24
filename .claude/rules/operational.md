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

## Comments — default ZERO

The owner dislikes comment noise, and the reviewer rejects on excess.

- Add a comment ONLY when it is genuinely critical and the code cannot convey it: a tricky invariant, a security reason, a deliberate deviation.
- **Never** explain a cast, a type subset, an obvious call, or what the next line does. When in doubt, leave it out.
- **No trailing comments.** Never place `//` to the right of code. Put it on its own line ABOVE; when it documents a declaration, make it a JSDoc block instead.
- Notes use `// @note <text>`. If the symbol already has a JSDoc block, fold the note INTO it rather than adding a separate line.
- `TODO` / `FIXME` are for their canonical purpose only.
- **Preserve an existing rule-compliant comment verbatim** during a refactor. It moves with its code; delete it only when its subject is provably gone, and never rephrase it.

## JSDoc — terse, and often absent

State what matters; skip filler. Do not restate the signature or the types the code already shows.

- Always ABOVE the symbol. When the symbol is decorated, JSDoc goes above the FIRST decorator — never between a decorator and the declaration.
- One or two lines maximum. WHAT, plus a non-obvious WHY (a security reason, a tricky invariant, a deliberate deviation, a notable throw condition).
- **Banned tags:** `@example` `@param` `@returns` `@template` `@throws` `@private` `@export` `@class` `@implements` `@constraint` `@remarks`. They restate the signature. Fold anything worth keeping into the prose sentence.
- **Not everything needs JSDoc.** A symbol self-evident from name and signature gets none — thin wrappers, trivial getters, lifecycle hooks with no surprising behavior, private helpers that just delegate.
- **Interfaces get NO JSDoc at all**, including per-field comments. This covers data shapes, payloads, and option bags. A genuinely critical invariant becomes one terse `// @note` line instead.
- **Modules with `forRoot()` / `forRootAsync()`:** document the module once at the class level; never the `forRoot` method separately.
- **Constants:** at most one line, only when the value's rationale is non-obvious (a limit tied to an external cap). DI tokens and self-evident names get none. **Enums:** only when a value's meaning is non-obvious.
- **DTOs:** a one-line class JSDoc if it helps. Fields already covered by `@ApiProperty` need none.
- **NO JSDoc at all in `controllers/`, `docs/` (`*.doc.ts`), `repositories/`, and `services/`.** Their role is fixed by the pattern — route delegation, Swagger doc, data access, business logic — and is self-evident. Do not add it; REMOVE any that exists. (`// @note` and `// TODO` line comments may stay.)

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
