# Workspace Feature Flag Configuration

Status: proposed. Nothing in this document is implemented yet.

## Overview

Features and their configurations are seeded rows. What a configuration may hold is defined in code by a zod schema, keyed by feature and configuration key. Administrators update existing rows; they cannot create or delete features or configurations.

- `FeatureFlag` is a seeded feature and its global operational control (`isEnable`, `rolloutPercent`, user targets).
- `FeatureFlagConfig` is a seeded configuration of a feature and its platform value.
- `FeatureFlagWorkspaceOverride` is one workspace-specific value for one configuration.
- `FeatureFlagConfigSchemas` is the code-owned map of value schemas. Every write validates against it.

The effective value of a configuration is the workspace override when one exists, otherwise the platform value.

The global flag and the standard `enabled` configuration answer different questions:

- `FeatureFlag.isEnable` is the non-overridable operational kill switch. It can stop a feature immediately and outranks rollout, targeting, configuration, and every override.
- Every feature has an `enabled` configuration. Its platform value is the normal availability default. A workspace-aware caller may resolve a workspace override; a platform-only caller resolves only the platform value.
- Other configuration keys enable a module capability or parameterize its behavior, such as `project / maxProjects`, `analytic / users`, invitation expiration, or delivery behavior.

Goals:

1. Keep the supported set of features and configurations closed: only seeded rows exist, and no endpoint creates or deletes them.
2. Validate every configuration and override value against the schema of its configuration key.
3. Let a platform administrator set or remove a configuration override for one workspace, with a per-row audit trail.
4. Return full resolution diagnostics to administrators and effective values only to workspace members.
5. Add a feature or configuration without a workspace backfill or a per-feature table.

Access:

- Platform administrators list features, update their global controls and platform values, and manage workspace overrides.
- Every member of a workspace reads that workspace's effective configuration.

## Related Documents

- [Feature Flag][ref-doc-feature-flag] - global evaluation, rollout, and user targeting
- [Workspace][ref-doc-workspace] - the tenancy boundary and `x-workspace-id` selection
- [Request Validation][ref-doc-request-validation] - zod request schemas and the validation pipe
- [Database][ref-doc-database] - Prisma conventions and seeding
- [Activity Log][ref-doc-activity-log] - action contracts
- [Status Codes][ref-doc-status-codes] - the `feature-flag` block

## Table of Contents

- [Decisions](#decisions)
- [Data Model](#data-model)
- [Configuration Schemas](#configuration-schemas)
- [Validation](#validation)
- [Evaluation](#evaluation)
- [Guard and Domain Enforcement](#guard-and-domain-enforcement)
- [Cache](#cache)
- [Lifecycle](#lifecycle)
- [API](#api)
- [Activity Log](#activity-log)
- [Status Codes](#status-codes)
- [Out of Scope](#out-of-scope)
- [Implementation Steps](#implementation-steps)

## Decisions

### The seed owns the catalog, the code owns the schemas

| Concern                                                          | Owner                         |
| ---------------------------------------------------------------- | ----------------------------- |
| Which features and configurations exist                          | Seed data                     |
| Descriptions and initial values                                  | Seed data                     |
| Operational state (`isEnable`, `rolloutPercent`, platform value) | Administrators, after seeding |
| What a configuration value may be                                | `FeatureFlagConfigSchemas`    |

There is no endpoint to create or delete a `FeatureFlag` or `FeatureFlagConfig`. An unsupported feature cannot be created because nothing creates features at runtime. Administrators may update `isEnable`, `rolloutPercent`, user targets, and the `value` of an existing configuration. They cannot change keys, descriptions, or schemas.

### Rows, not JSON blobs

Configurations and overrides are rows so that each value carries its own audit fields, has real foreign keys, and merges with the platform value through a plain join. `FeatureFlag.metadata` is removed.

### Sparse overrides

Workspace creation inserts no configuration rows. An override exists only when a workspace differs from the platform value.

- Adding a feature or configuration needs no workspace backfill.
- Deleting an override restores the platform value.
- Changing a platform value changes every workspace that has no override for that configuration.

### Any configuration can be stored as an override

Configurations are not marked as overridable. Callers decide whether a configuration is workspace-aware: workspace and project code resolve with a workspace ID, while platform code such as login and administrative analytics resolves without one and never reads overrides. An override written for a platform-only configuration is valid but inert for that flow.

### Module ownership

The feature-flag module owns the catalog, configurations, overrides, evaluation, cache, and HTTP contracts. Its global domain module exports the evaluator and the configuration resolver.

A feature flag represents one module-level operational boundary. For now, the catalog has one flag per participating module: `user`, `workspace`, `project`, and `analytic`. Capabilities and settings inside those modules are configuration rows.

The workspace module owns workspace resolution, membership, policies, `WorkspaceFeatureFlagProtected`, and `WorkspaceFeatureFlagDomain`. That domain validates the workspace and calls feature-flag domain methods. It never queries feature-flag models directly. `FeatureFlagDomain` does not inject `WorkspaceDomain`.

`FeatureFlagHttpModule` imports `WorkspaceDomainModule` for admin orchestration. The reverse dependency does not exist. Project and analytic domains consume the exported feature-flag domain and own enforcement for their operations, not override persistence.

### Naming convention

Feature keys are module names. Configuration keys are capability or setting names:

| Module flag | Example configuration keys                                                 |
| ----------- | -------------------------------------------------------------------------- |
| `user`      | `enabled`, `loginGoogle`, `signUp`, `forgotPassword`                       |
| `workspace` | `enabled`, `invitation`, `joinRequest`                                     |
| `project`   | `enabled`, `maxProjects`                                                   |
| `analytic`  | `enabled`, `auth`, `users`, `devices`, `workspaces`, `apiKeys`, `projects` |

The module key itself is the module-wide boundary, so the design does not add a `.core` suffix or use other dotted feature keys. A capability is promoted to its own feature only when it gains a concrete requirement for independent rollout, targeting, or an operational kill switch.

| Owner          | Examples                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `feature-flag` | `FeatureFlagConfig`, `FeatureFlagWorkspaceOverride`, `FeatureFlagConfigSchemas`, `FeatureFlagCache` |
| `workspace`    | `WorkspaceFeatureFlagDomain`, `WorkspaceFeatureFlagProtected`                                       |

Feature-flag-owned artifacts use `FeatureFlag...`. Workspace-owned composition uses `WorkspaceFeatureFlag...`.

## Data Model

### FeatureFlag

The existing model changes in one way: `metadata` is removed and a `configs` relation is added. `key`, `description`, `isEnable`, `rolloutPercent`, audit fields, and the `targetUsers` relation (`FeatureFlagUser`) are unchanged. `key` and `description` come from the seed.

### FeatureFlagConfig

Table `feature_flag_configs`:

| Field                                              | Type   | Notes                                                  |
| -------------------------------------------------- | ------ | ------------------------------------------------------ |
| `id`                                               | uuid   | `uuidv7()` default                                     |
| `featureFlagId`                                    | uuid   | FK to `FeatureFlag`, `onDelete: Cascade`               |
| `key`                                              | string | Seeded configuration key                               |
| `description`                                      | string | Seeded description                                     |
| `value`                                            | json   | Platform value, initialized by the seed, then editable |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` |        | Audit fields                                           |

- `@@unique([featureFlagId, key])`

The unique index already has `featureFlagId` as its leading column, so a separate index on that field is redundant.

### FeatureFlagWorkspaceOverride

Table `feature_flag_workspace_overrides`:

| Field                                              | Type | Notes                                                      |
| -------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `id`                                               | uuid | `uuidv7()` default                                         |
| `featureFlagConfigId`                              | uuid | FK to `FeatureFlagConfig`, `onDelete: Cascade`             |
| `workspaceId`                                      | uuid | FK to `Workspace`, `onDelete: Cascade`                     |
| `value`                                            | json | Replacement value, validated by the configuration's schema |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` |      | Audit fields                                               |

- `@@unique([workspaceId, featureFlagConfigId])`
- `@@index([featureFlagConfigId])`

The override does not carry `featureFlagId`; its configuration already identifies the feature. Soft-deleting a workspace keeps its overrides. Hard deletion cascades to them.

Example:

```text
FeatureFlag: project, isEnable = true
  FeatureFlagConfig: enabled, value = true
  FeatureFlagConfig: maxProjects, value = 10

Workspace A override: project / maxProjects = 3

FeatureFlag: workspace, isEnable = true
  FeatureFlagConfig: enabled, value = true
  FeatureFlagConfig: invitation, value = true

Workspace B override: workspace / invitation = false
```

Workspace A resolves `project / maxProjects = 3`. Workspace B resolves `workspace / invitation = false`. Every other workspace resolves the platform values.

## Configuration Schemas

The feature-flag module keeps one schema map. Every top-level key matches one persisted `FeatureFlag.key`. Every nested key matches one `FeatureFlagConfig.key` belonging to that feature.

```typescript
type FeatureFlagConfigSchema = {
    enabled: z.ZodBoolean;
} & Record<string, z.ZodType>;

export const FeatureFlagConfigSchemas = {
    user: {
        enabled: z.boolean(),
        loginGoogle: z.boolean(),
        loginApple: z.boolean(),
        loginCredential: z.boolean(),
        signUp: z.boolean(),
        changePassword: z.boolean(),
        forgotPassword: z.boolean(),
    },
    workspace: {
        enabled: z.boolean(),
        invitation: z.boolean(),
        joinRequest: z.boolean(),
    },
    project: {
        enabled: z.boolean(),
        maxProjects: z.number().int().min(1),
    },
    analytic: {
        enabled: z.boolean(),
        auth: z.boolean(),
        users: z.boolean(),
        devices: z.boolean(),
        workspaces: z.boolean(),
        apiKeys: z.boolean(),
        projects: z.boolean(),
    },
} as const satisfies Record<string, FeatureFlagConfigSchema>;
```

The map is the compile-time source for `FeatureFlagKey`, `FeatureFlagConfigKey<K>`, and the inferred value type of each configuration. It defines allowed value shapes, not database rows. The seed remains the catalog that materializes the four `FeatureFlag` rows and their `FeatureFlagConfig` rows.

A configuration row stores no scope, only its feature ID and its own key. Schema lookup therefore uses the two identifiers independently:

```typescript
export function getFeatureFlagConfigSchema(
    featureKey: string,
    configKey: string
): z.ZodType | undefined {
    const configs = FeatureFlagConfigSchemas[featureKey as FeatureFlagKey];

    return (configs as Record<string, z.ZodType> | undefined)?.[configKey];
}
```

- Derived types keep literal keys for compile-time callers such as `@FeatureFlagProtected` and configuration resolution.
- Every feature schema contains `enabled: z.boolean()`. The seed/schema parity test enforces that convention.
- A configuration row without a schema is server misconfiguration, never a silent pass. Lookup fails with `predefinedKeyNotFound`.
- Platform-only user flows resolve `user / enabled` and their capability configuration without a workspace ID. Overrides stored for those configurations remain valid but are inert for those flows.
- Workspace invitations and join requests are boolean configurations of the `workspace` feature. They share its operational state, rollout, and targeting.
- `project / maxProjects` is a positive integer. The seed sets its platform value to `10`, and a workspace override may replace that limit.
- The analytic category configurations are booleans on the `analytic` feature because they only partition one administrative surface; they do not need independent rollout or targeting.

### Complex configuration example

The initial `workspace` feature needs only `enabled`, `invitation`, and `joinRequest`. If invitation behavior later needs more configuration, it can add independently stored keys to the same feature:

```typescript
const workspaceConfigSchemas = {
    enabled: z.boolean(),
    invitation: z.boolean(),
    invitationExpiration: z
        .strictObject({
            defaultHours: z.number().int().min(1).max(720),
            maximumHours: z.number().int().min(1).max(2160),
        })
        .refine(value => value.defaultHours <= value.maximumHours, {
            message: 'defaultHours must not exceed maximumHours',
        }),
    invitationDeliveryChannels: z.array(z.enum(['email', 'link'])).min(1),
    invitationReminder: z.discriminatedUnion('enabled', [
        z.strictObject({
            enabled: z.literal(false),
        }),
        z.strictObject({
            enabled: z.literal(true),
            afterHours: z.number().int().min(1).max(168),
        }),
    ]),
    joinRequest: z.boolean(),
} as const satisfies FeatureFlagConfigSchema;
```

This object is the `workspace` entry in `FeatureFlagConfigSchemas`; the other module entries remain unchanged.

The seed adds one row per top-level configuration key:

```typescript
{
    key: 'workspace',
    description: 'Workspace capabilities',
    isEnable: true,
    rolloutPercent: 100,
    configs: [
        {
            key: 'enabled',
            description: 'Whether workspace capabilities are available',
            value: true,
        },
        {
            key: 'invitation',
            description: 'Whether invitations are available',
            value: true,
        },
        {
            key: 'invitationExpiration',
            description: 'Invitation expiration constraints',
            value: { defaultHours: 72, maximumHours: 168 },
        },
        {
            key: 'invitationDeliveryChannels',
            description: 'Permitted invitation delivery channels',
            value: ['email', 'link'],
        },
        {
            key: 'invitationReminder',
            description: 'Invitation reminder behavior',
            value: { enabled: true, afterHours: 24 },
        },
        {
            key: 'joinRequest',
            description: 'Whether workspace join requests are available',
            value: true,
        },
    ],
}
```

Each row resolves independently. A workspace may override only `invitationExpiration` and continue inheriting the other platform values:

```text
workspace / enabled                    -> platform
workspace / invitation                 -> platform
workspace / invitationExpiration       -> workspace
workspace / invitationDeliveryChannels -> platform
workspace / invitationReminder         -> platform
workspace / joinRequest                -> platform
```

The typed resolver call is `resolveConfig('workspace', 'invitationExpiration', workspaceId)`, and its value type is inferred from that schema.

An override replaces the complete value of one configuration row. It does not deep-merge objects. Fields such as `defaultHours` and `maximumHours` belong in one object because they share an invariant; settings that can change independently should remain separate configuration rows.

### Keeping the seed and schemas in sync

The seed and the schema map can drift, so three guards check them:

- The seed parses each seeded value through `getFeatureFlagConfigSchema` before writing it.
- The seed fails on a configuration key that has no schema.
- A unit test asserts that every seeded feature exists in the schema map, every feature has a boolean `enabled` schema, every seeded `(feature, config)` has a schema, and every schema has a seeded configuration.

## Validation

The schema of a configuration value depends on which configuration is written, so the request pipe cannot validate the value alone. Validation has three layers:

| Layer    | Validates                                                                            |
| -------- | ------------------------------------------------------------------------------------ |
| Pipe     | Request envelope: required fields, UUIDs, JSON-compatible `value`, no unknown fields |
| Domain   | The configuration row exists, then `value` against the schema of its feature and key |
| Database | Unique override per workspace and configuration, foreign keys                        |

### Pipe: request envelope

Request schemas are zod, bound through `RequestSchemaValidationPipe` as described in [Request Validation][ref-doc-request-validation]. They are strict objects, so extra fields are rejected.

```typescript
export const FeatureFlagConfigValueRequestSchema = z.strictObject({
    value: z.json(),
});

export const FeatureFlagUpdateStatusRequestSchema = z.strictObject({
    isEnable: z.boolean(),
    rolloutPercent: z.number().int().min(0).max(100),
});
```

Path parameters (`featureFlagId`, `featureFlagConfigId`, `workspaceId`) use the shared UUID schema. The request does not select a schema. It carries a JSON `value`, and the domain chooses the schema from the persisted row.

### Domain: content

The domain loads the configuration row, which provides `(featureKey, configKey)` from the database and never from the request. It then validates the value with the schema from the map:

```typescript
@Injectable()
export class FeatureFlagDomain {
    constructor(
        private readonly featureFlagConfigRepository: FeatureFlagConfigRepository,
        private readonly featureFlagWorkspaceOverrideRepository: FeatureFlagWorkspaceOverrideRepository
    ) {}

    async updateConfigValue(
        featureFlagConfigId: string,
        { value }: FeatureFlagConfigValueRequestDto
    ): Promise<FeatureFlagConfig> {
        const config = await this.featureFlagConfigRepository.findOneOrFail(
            featureFlagConfigId // includes featureFlag { key }
        );

        return this.featureFlagConfigRepository.updateValue(
            config.id,
            this.parseInput(config, value)
        );
    }

    async setWorkspaceOverride(
        workspaceId: string,
        featureFlagConfigId: string,
        { value }: FeatureFlagConfigValueRequestDto
    ): Promise<FeatureFlagWorkspaceOverride> {
        const config =
            await this.featureFlagConfigRepository.findOneOrFail(
                featureFlagConfigId
            );

        return this.featureFlagWorkspaceOverrideRepository.upsert({
            featureFlagConfigId: config.id,
            workspaceId,
            value: this.parseInput(config, value),
        });
    }

    async deleteWorkspaceOverride(
        workspaceId: string,
        featureFlagConfigId: string
    ): Promise<void> {
        await this.featureFlagWorkspaceOverrideRepository.deleteByWorkspaceAndConfig(
            workspaceId,
            featureFlagConfigId
        );
    }

    /** Validates a request value against the schema of the persisted configuration row. */
    private parseInput(
        config: { key: string; featureFlag: { key: string } },
        value: unknown
    ): Prisma.InputJsonValue {
        const schema = getFeatureFlagConfigSchema(
            config.featureFlag.key,
            config.key
        );
        if (!schema) {
            throw new FeatureFlagPredefinedKeyNotFoundException();
        }

        const result = schema.safeParse(value);
        if (!result.success) {
            throw new FeatureFlagConfigInvalidException({
                issues: result.error.issues.map(issue => issue.path.join('.')),
            });
        }

        return result.data as Prisma.InputJsonValue;
    }
}
```

`FeatureFlagDomain` does not inject `WorkspaceDomain`. `WorkspaceFeatureFlagDomain` validates the workspace, then delegates override writes and resolution to `FeatureFlagDomain`. This keeps ownership one-way and avoids a module cycle.

Error data lists issue paths only, never the rejected value. An unknown configuration ID maps to `configNotFound`. Setting an override creates or replaces the row, and deleting an override that does not exist is a successful no-op. Controllers do not translate these outcomes.

### Stored values

The resolver parses values read from the database with the same two-key schema lookup. A failure there is a server misconfiguration and throws `FeatureFlagPredefinedKeyTypeInvalidException` (500) instead of `configInvalid` (400). Call sites with static keys can use the schema directly, such as `FeatureFlagConfigSchemas.project.maxProjects`.

## Evaluation

### Global feature evaluation

Every availability evaluation first performs the global check described in [Feature Flag][ref-doc-feature-flag]:

1. Resolve the persisted `FeatureFlag`. A missing row for a statically defined key is server misconfiguration and throws `predefinedKeyNotFound`.
2. Reject when `FeatureFlag.isEnable` is false.
3. Apply user targeting and deterministic user or anonymous rollout.

Rollout and targeting stay user-based and unchanged. The feature key is typed against the top-level keys of `FeatureFlagConfigSchemas`, so a misspelled feature key fails at compile time.

### Configuration resolution

1. Resolve the `FeatureFlagConfig` by feature key and configuration key.
2. Parse its `value` with the schema from the map.
3. When the caller supplied no workspace, return the platform value.
4. Otherwise find the workspace override for that configuration.
5. Parse and return the override value when it exists.
6. Otherwise return the platform value.

The resolver returns the effective value and its source:

```typescript
type FeatureFlagConfigSource = 'platform' | 'workspace';
```

An invalid persisted value fails as server misconfiguration. The resolver never falls back silently.

### Effective feature availability

After the global check passes, availability resolves the feature's required `enabled` configuration and, when requested, one boolean capability configuration:

```text
global FeatureFlag evaluation passes
    AND
resolved enabled configuration is true
    AND
optional resolved capability configuration is true
```

`@FeatureFlagProtected('<feature>', '<capability?>')` resolves platform values. `@WorkspaceFeatureFlagProtected('<feature>', '<capability?>')` resolves effective workspace values. The optional capability is typed to boolean configuration keys other than `enabled`; numeric or structured settings cannot be used as route gates. The workspace decorator performs the global check itself, so the two decorators are never stacked for the same feature.

`FeatureFlag.isEnable = false` rejects every caller. A false workspace override affects only that workspace. A resolved false `enabled` or capability value rejects with `serviceUnavailable`, and a stored value that does not match its boolean schema fails with `predefinedKeyTypeInvalid`.

## Guard and Domain Enforcement

- `@FeatureFlagProtected('<feature>', '<capability?>')` applies the global check, the platform `enabled` value, and the optional platform capability value.
- `@WorkspaceFeatureFlagProtected('<feature>', '<capability?>')` applies the same checks with effective workspace values. It is workspace-owned because it composes workspace resolution with feature-flag evaluation.
- `WorkspaceGuard` resolves and stores the workspace before the workspace feature guard runs.
- Policy guards run after feature availability checks. Feature availability is not authorization.

For example, `@FeatureFlagProtected('user', 'loginGoogle')` protects a platform-only user capability, while `@WorkspaceFeatureFlagProtected('workspace', 'invitation')` applies the workspace override when one exists.

```typescript
@ProjectPolicyProtected({
    subject: EnumPolicySubject.Project,
    action: [EnumPolicyAction.read],
})
@WorkspaceFeatureFlagProtected('project')
@WorkspaceProtected()
@UserProtected()
@AuthJwtAccessProtected()
@ApiKeyProtected()
@Get('/list')
async list(): Promise<IResponsePaginationReturn<ProjectResponseDto>> { ... }
```

NestJS evaluates decorators bottom-up. The stack authenticates the user, stores the workspace, evaluates global and workspace feature availability, and then evaluates policies. Guards and owning domains use the same cache-backed evaluator, while queue, CLI, and internal callers invoke the domain directly.

Not every workspace-bound operation begins with `WorkspaceGuard`:

- Invite preview and claim resolve the workspace from the validated invite token, then evaluate `workspace / invitation` in the invite domain.
- Invite-based sign-up resolves the invite workspace before onboarding and evaluates the same feature there.
- Join-request creation resolves the requested workspace before evaluating `workspace / joinRequest`.
- No evaluator trusts `x-workspace-id` until `WorkspaceGuard` has resolved it.

| Feature/config            | Gated operations                                                       | Cleanup still allowed                                             |
| ------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `workspace / invitation`  | Create, resend, preview, claim, invite-based sign-up, list, and revoke | Expiry sweep                                                      |
| `workspace / joinRequest` | Create, list, accept, and reject                                       | Cancellation during workspace deletion                            |
| `project / enabled`       | Every user-scope project operation                                     | Workspace deletion still soft-deletes projects in one transaction |

Disabling a module or capability closes its interactive operations but keeps lifecycle cleanup. Existing invitations and join requests remain stored and become manageable again when the applicable configurations are re-enabled.

### Project limit

`project / maxProjects` limits active projects in one workspace. It is enforced only when creating a project; lowering the value below the current count does not delete or disable existing projects. Soft-deleted projects do not count and therefore free capacity.

The limit check joins the existing project-and-admin-member creation transaction:

1. `ProjectDomain` opens `DatabaseService.withTransaction` with PostgreSQL `Serializable` isolation.
2. `FeatureFlagDomain.resolveConfigInTx` resolves `project / maxProjects` for the workspace through feature-flag repository `*InTx` methods. It reads the database directly and does not use Redis inside the transaction.
3. `ProjectRepository.countActiveByWorkspaceInTx` counts active projects through the same transaction client.
4. When the count is greater than or equal to the resolved limit, the domain throws `ProjectCapReachedException` before creating anything.
5. Otherwise the domain creates the project and its initial admin member through their existing `*InTx` methods.

Serializable isolation prevents two concurrent count-and-create transactions from both committing above the limit. A serialization conflict follows the repository's existing `P2034` behavior and is not retried automatically. Redis is never used as a lock.

### Analytic categories

The `analytic` feature is platform-scoped because `AnalyticAdminController` has no workspace context. Its standard `enabled` configuration gates every analytic route. Six additional boolean configurations gate the matching controller route families:

| Configuration | Controller routes        |
| ------------- | ------------------------ |
| `auth`        | `/analytic/auth/*`       |
| `users`       | `/analytic/users/*`      |
| `devices`     | `/analytic/devices/*`    |
| `workspaces`  | `/analytic/workspaces/*` |
| `apiKeys`     | `/analytic/api-keys/*`   |
| `projects`    | `/analytic/projects/*`   |

The generic platform guard handles these categories. For example, `@FeatureFlagProtected('analytic', 'users')` evaluates the global `analytic` flag, its platform `enabled` configuration, and the platform `users` configuration. A false category rejects with `serviceUnavailable`.

```typescript
@PlatformPolicyProtected({
    subject: EnumPolicySubject.analytic,
    action: [EnumPolicyAction.read],
})
@FeatureFlagProtected('analytic', 'users')
@Get('/users/registrations')
async usersRegistrations(/* ... */): Promise</* ... */> { ... }
```

The `/analytic/term-policies/*`, `/analytic/fraud/*`, and `/analytic/anomaly/*` routes use `@FeatureFlagProtected('analytic')` because no separate category switch is defined for them. Workspace overrides stored for analytic configurations are valid but inert for these platform administration routes.

## Cache

- `FeatureFlag:{key}` stores the flag, its configuration rows, and its user targets.
- `FeatureFlag:Workspace:{workspaceId}:Override:{featureKey}` stores the workspace's override rows for one feature.
- Configuration owns the complete key patterns, filled through `HelperStringService.fillPattern`.
- Reads are cache-through and best-effort; failures fall through to the database.
- Status, target, and platform-value writes invalidate the global entry after the database write succeeds. Override writes invalidate the workspace-feature entry after the database write succeeds. Workspace deletion relies on database cascade and cache TTL for any stale scoped entry.
- The effective value is computed from cached rows on every read, not cached as a verdict.

## Lifecycle

### Seed

`src/migration/data/migration.feature-flag.data.ts` becomes the catalog. It lists each feature with its description, operational state, and configurations with their descriptions and initial values.

```typescript
interface IFeatureFlagSeed {
    key: FeatureFlagKey;
    description: string;
    isEnable: boolean;
    rolloutPercent: number;
    configs: {
        key: string;
        description: string;
        value: unknown;
    }[];
}
```

The seed is idempotent whenever the owner invokes the seeding workflow:

- A missing `FeatureFlag` or `FeatureFlagConfig` is created from the seed entry.
- An existing row keeps its operator-set `isEnable`, `rolloutPercent`, targets, and `value`. The seed refreshes only `description`.
- Every seeded `value` is parsed through `getFeatureFlagConfigSchema` before writing. A configuration key without a schema fails the seed.
- A persisted feature or configuration missing from the seed is reported as an integrity failure and is not deleted.

### Migration of existing data

Existing rows and metadata migrate through this explicit mapping:

| Existing source                         | Target configuration      | Initial value                                       |
| --------------------------------------- | ------------------------- | --------------------------------------------------- |
| `loginWithGoogle`                       | `user / loginGoogle`      | `isEnable && metadata.signUpAllowed`                |
| `loginWithApple`                        | `user / loginApple`       | `isEnable && metadata.signUpAllowed`                |
| `loginWithCredential`                   | `user / loginCredential`  | `isEnable`                                          |
| `signUp`                                | `user / signUp`           | `isEnable`                                          |
| `changePassword`                        | `user / changePassword`   | `isEnable`                                          |
| `changePassword.metadata.forgotAllowed` | `user / forgotPassword`   | `changePassword.isEnable && metadata.forgotAllowed` |
| `workspace`                             | `workspace / enabled`     | `true`                                              |
| `workspace.metadata.invitationAllowed`  | `workspace / invitation`  | Stored `invitationAllowed` value                    |
| `workspace.metadata.joinRequestAllowed` | `workspace / joinRequest` | Stored `joinRequestAllowed` value                   |

The migration creates one `user` feature with `isEnable = true` and `rolloutPercent = 100`, writes the mapped configurations, and then removes the superseded user capability features. Before doing so, it fails if any source user flag has a rollout percentage other than `100` or has explicit user targets. Those independent rollout rules cannot be represented by boolean configurations and require an operator decision instead of silent loss.

The existing `workspace` feature keeps its `isEnable`, `rolloutPercent`, and targets. Mapping provider `signUpAllowed` into the provider capability intentionally replaces the old distinction between provider login and provider-assisted sign-up with one provider availability setting. Any unknown persisted metadata key stops the migration instead of being silently dropped.

The subsequent seed creates any missing module and configuration rows. `project / maxProjects` starts at `10`; `analytic / enabled` and all six analytic categories start as `true`; all other new boolean configurations start as `true`. The owner applies the schema with `pnpm db:migrate`, then runs the seed before deploying runtime code.

### Workspace creation

Workspace creation writes no feature configuration data. A new workspace inherits platform values.

### Catalog changes

- Adding a feature or configuration means editing `FeatureFlagConfigSchemas` and the seed in the same change, then reseeding. Existing workspaces inherit the new defaults without backfill.
- Removing a feature or configuration requires an explicit data migration, then removal from the seed and the schema map.

For example, adding project export requires no database schema change:

1. Add `export: z.boolean()` and `exportFormats: z.array(z.enum(['csv', 'json']))` to `FeatureFlagConfigSchemas.project`.
2. Add `export` and `exportFormats` configuration rows to the `project` seed entry.
3. Enforce availability with `@WorkspaceFeatureFlagProtected('project', 'export')` on HTTP routes and the same evaluator in non-HTTP entry points. Resolve `project / exportFormats` only where the export operation needs it.
4. Run the parity test and seed. Existing workspaces inherit the platform values until an override is set.

If export later needs its own rollout, user targets, or emergency kill switch, promote it to a separate `FeatureFlag` through an explicit catalog and data migration. That is a later requirement, not structure carried by every capability now.

## API

The feature-flag module owns these controllers, DTOs, and response contracts. Workspace-addressed routes delegate to `WorkspaceFeatureFlagDomain`.

### Platform administration

The list is a database read of features with their configurations and platform values.

| Method | Path                                               | Purpose                                          |
| ------ | -------------------------------------------------- | ------------------------------------------------ |
| GET    | `/admin/feature-flag/list`                         | List features with configurations                |
| PATCH  | `/admin/feature-flag/update/:featureFlagId/status` | Update `isEnable` and `rolloutPercent`           |
| PATCH  | `/admin/feature-flag/configs/:featureFlagConfigId` | Update one existing platform configuration value |

The existing user-target behavior on the status route is unchanged. There is no create or delete route.

### Workspace member

| Method | Path                           | Purpose                                                             |
| ------ | ------------------------------ | ------------------------------------------------------------------- |
| GET    | `/user/feature-flag/workspace` | List features with effective configuration for the active workspace |

Each configuration includes `id`, `key`, `description`, and `value`. The member response exposes only the effective value; platform defaults and override sources are administrative details.

### Workspace override administration

Admin routes address the workspace in the path because admin scope does not use `x-workspace-id`. `WorkspaceFeatureFlagDomain` owns workspace validation and write orchestration.

| Method | Path                                                                                | Purpose                                                     |
| ------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| GET    | `/admin/feature-flag/workspaces/:workspaceId`                                       | List platform value, effective value, and source per config |
| PUT    | `/admin/feature-flag/workspaces/:workspaceId/configs/:featureFlagConfigId/override` | Create or replace one configuration override                |
| DELETE | `/admin/feature-flag/workspaces/:workspaceId/configs/:featureFlagConfigId/override` | Remove the override; the platform value applies again       |

PUT takes `{ value }` and is idempotent for the workspace and configuration pair. It rejects an unknown workspace or configuration. DELETE is also idempotent: a missing override is a successful no-op. Cache invalidation follows the database write.

## Activity Log

Reads create no activity. Writes use these actions:

| Action                                    | Written by                | Metadata                                                                     |
| ----------------------------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| `adminFeatureFlagConfigUpdate`            | PATCH of a platform value | Feature key, configuration key, previous value, and resulting value          |
| `adminFeatureFlagWorkspaceOverrideSet`    | PUT of an override        | Feature key, configuration key, optional previous value, and resulting value |
| `adminFeatureFlagWorkspaceOverrideDelete` | DELETE of an override     | Feature key, configuration key, and removed value                            |

Metadata is flat and validated by a discriminated zod schema. Values are JSON-encoded. Configuration values exclude credentials and tokens, so they are safe to log. Config writes use `user: payload`; override writes also use `workspace: target`. Each mutation writes one action; an idempotent DELETE that finds no override writes no activity. The existing status update keeps its current action.

## Status Codes

Reused from the existing `feature-flag` block:

- `notFound` (`50600`, 404) for an unknown `featureFlagId` on an admin path.
- `serviceUnavailable` (`50601`, 503) for a disabled global flag, failed rollout or targeting, or a resolved false gate.
- `predefinedKeyTypeInvalid` (`50605`, 500) when a persisted value does not match its schema.
- `predefinedKeyNotFound` (`50606`, 500) when a statically defined feature has no persisted row or a configuration row has no schema.

`configInvalid` (`50602`, 400) identifies a request value rejected by its configuration schema.

Added:

| member           | statusCode | HTTP | messagePath                        | Description                                                  |
| ---------------- | ---------: | ---: | ---------------------------------- | ------------------------------------------------------------ |
| `configNotFound` |    `50607` |  404 | `featureFlag.error.configNotFound` | The `featureFlagConfigId` does not identify a configuration. |

`predefinedKeyLengthExceeded` and `predefinedKeyEmpty` are removed. Feature and configuration keys are supplied separately and validated against `FeatureFlagConfigSchemas`; the guard no longer parses a composite key path.

The project block adds:

| member       | statusCode | HTTP | messagePath                | Description                                          |
| ------------ | ---------: | ---: | -------------------------- | ---------------------------------------------------- |
| `capReached` |    `51708` |  400 | `project.error.capReached` | The workspace has reached its effective project cap. |

## Out of Scope

These are deliberately left out of this design. The tables and schema map allow adding them later without breaking changes:

- **Runtime creation of features and configurations.** The catalog changes only through the seed.
- **Dated or scheduled overrides.** Add temporal columns and precedence rules only when a concrete scheduling requirement exists.
- **Workspace-subject rollout and workspace targets.** Rollout and explicit targets stay user-based as they are today. Per-workspace availability is expressed through the `enabled` configuration.
- **Independent rollout or targeting for every capability.** Capabilities remain configurations until a concrete need justifies promoting one to a separately seeded feature.
- **Project-level overrides.** Add a typed `FeatureFlagProjectOverride` with a real `projectId` foreign key when individual projects need different values. Do not use a polymorphic scope column.
- **External flag services.** OpenFeature would not replace the application-owned catalog, validation, or precedence.

## Implementation Steps

Test-first, in this order:

1. Add the `FeatureFlagConfig` and `FeatureFlagWorkspaceOverride` models and the activity actions; remove `FeatureFlag.metadata`. Write the migration that converts existing metadata through an explicit key mapping. The owner applies it with `pnpm db:migrate`.
2. Define the central `FeatureFlagConfigSchemas`, `getFeatureFlagConfigSchema`, and the derived feature, configuration, boolean-configuration, and value types. Add the unit test that matches seeded configurations to schemas and requires a boolean `enabled` schema for every feature.
3. Extend `src/migration/data/migration.feature-flag.data.ts` with the four module flags and their configurations, including `project / maxProjects = 10` and all analytic categories enabled. Make the seed idempotent: create missing rows, refresh descriptions only, validate every value, and report orphaned rows.
4. Add configuration and override repositories, cached resolution, transaction-aware `resolveConfigInTx`, cache patterns, and post-write invalidation.
5. Add exceptions, status codes, and i18n messages. Rename `invalidMetadata` to `configInvalid`.
6. Add the domain methods for configuration update and idempotent override set and delete, with the `parseInput` validation and activity contracts.
7. Make `@FeatureFlagProtected` and `@WorkspaceFeatureFlagProtected` accept a feature key and an optional boolean capability key. Both evaluate global controls and `enabled`; when provided, they also evaluate the capability. The workspace decorator uses workspace-effective values.
8. Collapse the user capability flags into `user` configurations and enforce them with calls such as `@FeatureFlagProtected('user', 'loginGoogle')`.
9. Enforce `workspace / invitation` and `workspace / joinRequest` across their complete interactive flows. Keep expiry and workspace-deletion cleanup available.
10. Protect project routes with `project` and enforce `maxProjects` during project creation with an uncached configuration read and active-project count inside the existing project creation transaction at serializable isolation.
11. Apply `@FeatureFlagProtected('analytic', '<category>')` to the six corresponding `AnalyticAdminController` route families. Gate the remaining analytic routes with `@FeatureFlagProtected('analytic')`.
12. Leave module-wide workspace lifecycle on `workspace`. Replace the metadata update route and `checkMetadataKey` with configuration update by ID. Make the admin list a database read of features and configurations.
13. Add the workspace DTOs, controllers, and the user route. Verify the module wiring has no cycle.
14. Add `ProjectCapReachedException` (`51708`) and update [Feature Flag][ref-doc-feature-flag], [Workspace][ref-doc-workspace], [Activity Log][ref-doc-activity-log], and [Status Codes][ref-doc-status-codes] after the runtime implementation lands.

<!-- REFERENCES -->

[ref-doc-feature-flag]: ../feature-flag.md
[ref-doc-workspace]: ../workspace.md
[ref-doc-request-validation]: ../request-validation.md
[ref-doc-database]: ../database.md
[ref-doc-activity-log]: ../activity-log.md
[ref-doc-status-codes]: ../status-codes.md
