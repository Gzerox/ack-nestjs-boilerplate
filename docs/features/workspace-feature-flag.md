# Workspace Feature Flag Configuration

Status: proposed. Nothing in this document is implemented yet.

## Overview

Features and their configurations are seeded rows. A feature is identified by its namespace and key. What a configuration may hold is defined in code by a zod schema, keyed by namespace, feature, and configuration key. Administrators update existing rows; they cannot create or delete features or configurations.

- `FeatureFlag` is a seeded feature identified by `(namespace, key)` and carries its platform-controlled availability (`isEnable`, `rolloutPercent`, user targets).
- `FeatureFlagConfig` is a seeded configuration of a feature and its platform value.
- `FeatureFlagConfigWorkspaceOverride` is one workspace-specific value for one configuration.
- `FeatureFlagConfigSchemas` is the code-owned map of value schemas. Every write validates against it.

The effective value of a configuration is the workspace override when one exists, otherwise the platform value.

`FeatureFlag.isEnable` is the operational kill switch. It can stop a feature immediately and outranks rollout, targeting, and configuration. A workspace cannot override feature availability. Configuration keys only parameterize an available feature. The initial catalog has one configuration: `workspace / invitation / expiredInDays`.

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

### The code owns identifiers and schemas, the seed materializes them

| Concern                                             | Owner                         |
| --------------------------------------------------- | ----------------------------- |
| Supported namespaces, feature keys, and config keys | `FeatureFlagConfigSchemas`    |
| Descriptions and initial values                     | Seed data                     |
| Operational state and platform values               | Administrators, after seeding |
| Configuration value schema                          | `FeatureFlagConfigSchemas`    |

There is no endpoint to create or delete a `FeatureFlag` or `FeatureFlagConfig`. An unsupported feature cannot be created because nothing creates features at runtime. Administrators may update `isEnable`, `rolloutPercent`, user targets, and the `value` of an existing configuration. They cannot change keys, descriptions, or schemas.

### Rows, not JSON blobs

Configurations and overrides are rows so that each value carries its own audit fields, has real foreign keys, and merges with the platform value through a plain join. `FeatureFlag.metadata` is removed.

### Sparse overrides

Workspace creation inserts no configuration rows. An override exists only when a workspace differs from the platform value.

- Adding a feature or configuration needs no workspace backfill.
- Deleting an override restores the platform value.
- Changing a platform value changes every workspace that has no override for that configuration.

### Every configuration can be overridden

Every `FeatureFlagConfig.value` is the platform value. A workspace inherits that value when no `FeatureFlagConfigWorkspaceOverride` references the configuration. When a matching override row exists, its value completely replaces the platform value for that workspace.

Override eligibility needs no configuration metadata. Platform resolution reads the platform value without a workspace. Workspace resolution applies a matching workspace override for any configuration.

### Module ownership

The feature-flag module owns the catalog, configurations, overrides, evaluation, cache, and HTTP contracts. Its global domain module exports the evaluator and the configuration resolver.

A namespace groups related feature keys for identity and typing. It does not create an evaluation hierarchy. Each feature key is an independently evaluated operational boundary. For example, `workspace.invitation`, `workspace.joinRequest`, and `workspace.project` share a namespace but do not enable or disable one another. Likewise, `user.loginGoogle` and `user.loginApple` do not depend on `user.loginCredential` or `user.signUp`.

The workspace module owns workspace resolution, membership, policies, and `WorkspaceFeatureFlagDomain`. That domain validates the workspace and calls feature-flag configuration methods. It never queries feature-flag models directly. `FeatureFlagDomain` does not inject `WorkspaceDomain`.

`FeatureFlagHttpModule` imports `WorkspaceDomainModule` for admin orchestration. The reverse dependency does not exist. Project and analytic domains consume the exported feature-flag domain and own enforcement for their operations, not override persistence.

### Naming convention

Namespaces identify capability families. Feature keys identify independently evaluated capabilities. Configuration keys identify parameters of one feature:

| Namespace   | Feature keys                                                                                        | Configuration keys         |
| ----------- | --------------------------------------------------------------------------------------------------- | -------------------------- |
| `user`      | `loginGoogle`, `loginApple`, `loginCredential`, `signUp`, `changePassword`, `forgotPassword`        | None                       |
| `workspace` | `invitation`, `joinRequest`, `project`                                                              | `invitation.expiredInDays` |
| `analytic`  | `auth`, `users`, `devices`, `workspaces`, `apiKeys`, `projects`, `termPolicies`, `fraud`, `anomaly` | None                       |

Names such as `workspace.project` are documentation shorthand for separate `namespace = 'workspace'` and `key = 'project'` values. The database and APIs do not parse dotted strings.

| Owner          | Examples                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| `feature-flag` | `FeatureFlagConfig`, `FeatureFlagConfigWorkspaceOverride`, `FeatureFlagConfigSchemas`, `FeatureFlagCache` |
| `workspace`    | `WorkspaceFeatureFlagDomain`                                                                              |

Feature-flag-owned artifacts use `FeatureFlag...`. Workspace-owned composition uses `WorkspaceFeatureFlag...`.

## Data Model

### FeatureFlag

The model adds `namespace` and a `configs` relation, and removes `metadata`. `namespace`, `key`, and `description` come from the seed. `isEnable`, `rolloutPercent`, audit fields, and the `targetUsers` relation (`FeatureFlagUser`) remain operational data.

- `@@unique([namespace, key])`

The namespace and key are camelCase identifiers. Neither contains a dot.

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

### FeatureFlagConfigWorkspaceOverride

Table `feature_flag_config_workspace_overrides`:

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
FeatureFlag: workspace.invitation, isEnable = true
  FeatureFlagConfig: expiredInDays, value = 7

Workspace A override: workspace / invitation / expiredInDays = 3
```

Workspace A resolves `workspace / invitation / expiredInDays = 3`. Every other workspace resolves the platform value of `7`. The `workspace.invitation` feature remains platform-controlled.

## Configuration Schemas

The feature-flag module keeps one three-level schema map. The first key matches `FeatureFlag.namespace`, the second matches `FeatureFlag.key`, and the third matches a `FeatureFlagConfig.key` belonging to that feature. An empty object represents a feature without configuration.

```typescript
export const FeatureFlagConfigSchemas = {
    user: {
        loginGoogle: {},
        loginApple: {},
        loginCredential: {},
        signUp: {},
        changePassword: {},
        forgotPassword: {},
    },
    workspace: {
        invitation: {
            expiredInDays: z.enum(EnumWorkspaceInviteExpiry),
        },
        joinRequest: {},
        project: {},
    },
    analytic: {
        auth: {},
        users: {},
        devices: {},
        workspaces: {},
        apiKeys: {},
        projects: {},
        termPolicies: {},
        fraud: {},
        anomaly: {},
    },
} as const satisfies Record<string, Record<string, Record<string, z.ZodType>>>;
```

The map is the compile-time source for `FeatureFlagNamespace`, `FeatureFlagKey<N>`, `FeatureFlagConfigKey<N, F>`, and the inferred value type of each configuration. It defines the supported identifiers and value shapes. The seed materializes matching `FeatureFlag` and `FeatureFlagConfig` rows with descriptions and initial values.

A configuration row stores its feature ID and configuration key. Schema lookup uses the persisted feature namespace, feature key, and configuration key:

```typescript
export function getFeatureFlagConfigSchema(
    namespace: string,
    featureKey: string,
    configKey: string
): z.ZodType | undefined {
    const features =
        FeatureFlagConfigSchemas[namespace as FeatureFlagNamespace];
    const configs = (
        features as Record<string, Record<string, z.ZodType>> | undefined
    )?.[featureKey];

    return configs?.[configKey];
}
```

- Derived types keep literal namespace, feature, and configuration keys for compile-time callers such as `@FeatureFlagProtected` and configuration resolution.
- Every operational toggle is a feature. Configuration schemas describe parameters and are never evaluated as availability gates.
- A configuration row without a schema is server misconfiguration, never a silent pass. Lookup fails with `predefinedKeyNotFound`.
- `workspace.invitation.expiredInDays` uses the existing `EnumWorkspaceInviteExpiry` values. The seed sets its platform value to `7`.
- Analytic categories are independent features under the `analytic` namespace.

### Seeded configuration

Invitation availability belongs to `workspace.invitation`. Its default lifetime is the only initial configuration value:

```typescript
const workspaceFeatureConfigSchemas = {
    invitation: {
        expiredInDays: z.enum(EnumWorkspaceInviteExpiry),
    },
} as const satisfies Record<string, Record<string, z.ZodType>>;
```

The seed adds the matching configuration row to `workspace.invitation`:

```typescript
{
    namespace: 'workspace',
    key: 'invitation',
    description: 'Workspace invitations',
    isEnable: true,
    rolloutPercent: 100,
    configs: [
        {
            key: 'expiredInDays',
            description: 'Default invitation lifetime in days',
            value: EnumWorkspaceInviteExpiry.sevenDays,
        },
    ],
}
```

The typed resolver call is:

```typescript
resolveWorkspaceConfig(workspaceId, 'workspace', 'invitation', 'expiredInDays');
```

Its value type is inferred from that schema. Invite creation and resend use the resolved value when the request omits `expiryDuration`; an explicit request value continues to take precedence. An override replaces the complete value of one configuration row and does not deep-merge objects.

### Keeping the seed and schemas in sync

The seed and the schema map can drift, so three guards check them:

- The seed parses each seeded value through `getFeatureFlagConfigSchema` before writing it.
- The seed fails on a namespace, feature key, or configuration key that has no matching definition.
- A unit test asserts both directions: every seeded flag has a feature entry, every seeded configuration has a schema, every feature entry has a seeded flag, and every configuration schema has a seeded configuration.

## Validation

The schema of a configuration value depends on which configuration is written, so the request pipe cannot validate the value alone. Validation has three layers:

| Layer    | Validates                                                                            |
| -------- | ------------------------------------------------------------------------------------ |
| Pipe     | Request envelope: required fields, UUIDs, JSON-compatible `value`, no unknown fields |
| Domain   | The configuration exists and the value matches its namespace-feature-config schema   |
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

The domain loads the configuration row, which provides `(namespace, featureKey, configKey)` from the database and never from the request. It then validates the value with the schema from the map:

```typescript
@Injectable()
export class FeatureFlagDomain {
    constructor(
        private readonly featureFlagConfigRepository: FeatureFlagConfigRepository,
        private readonly featureFlagConfigWorkspaceOverrideRepository: FeatureFlagConfigWorkspaceOverrideRepository
    ) {}

    /** Validates a request value against the schema of the persisted configuration row. */
    private parseInput(
        config: {
            key: string;
            featureFlag: { namespace: string; key: string };
        },
        value: unknown
    ): Prisma.InputJsonValue {
        const schema = getFeatureFlagConfigSchema(
            config.featureFlag.namespace,
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

    async updateConfigValue(
        featureFlagConfigId: string,
        { value }: FeatureFlagConfigValueRequestDto
    ): Promise<FeatureFlagConfig> {
        const config = await this.featureFlagConfigRepository.findOneOrFail(
            featureFlagConfigId // includes featureFlag { namespace, key }
        );
        const parsed = this.parseInput(config, value);

        return this.featureFlagConfigRepository.updateValue(config.id, parsed);
    }

    async setWorkspaceOverride(
        workspaceId: string,
        featureFlagConfigId: string,
        { value }: FeatureFlagConfigValueRequestDto
    ): Promise<FeatureFlagConfigWorkspaceOverride> {
        const config =
            await this.featureFlagConfigRepository.findOneOrFail(
                featureFlagConfigId
            );
        const parsed = this.parseInput(config, value);

        return this.featureFlagConfigWorkspaceOverrideRepository.upsert({
            featureFlagConfigId: config.id,
            workspaceId,
            value: parsed,
        });
    }

    async deleteWorkspaceOverride(
        workspaceId: string,
        featureFlagConfigId: string
    ): Promise<void> {
        await this.featureFlagConfigRepository.findOneOrFail(
            featureFlagConfigId
        );

        await this.featureFlagConfigWorkspaceOverrideRepository.deleteByWorkspaceAndConfig(
            workspaceId,
            featureFlagConfigId
        );
    }
}
```

`FeatureFlagDomain` does not inject `WorkspaceDomain`. `WorkspaceFeatureFlagDomain` validates the workspace, then delegates override writes and resolution to `FeatureFlagDomain`. This keeps ownership one-way and avoids a module cycle.

Error data lists issue paths only, never the rejected value. An unknown configuration ID maps to `configNotFound`. Setting an override creates or replaces the row, and deleting an override that does not exist is a successful no-op. Controllers do not translate these outcomes.

### Stored values

The resolver parses values read from the database with the same three-key schema lookup. A failure there is a server misconfiguration and throws `FeatureFlagPredefinedKeyTypeInvalidException` (500) instead of `configInvalid` (400). Call sites with static keys can use the schema directly, such as `FeatureFlagConfigSchemas.workspace.invitation.expiredInDays`.

## Evaluation

### Global feature evaluation

Every availability evaluation first performs the global check described in [Feature Flag][ref-doc-feature-flag]:

1. Resolve the persisted `FeatureFlag` by namespace and key. A missing row for a statically defined pair is server misconfiguration and throws `predefinedKeyNotFound`.
2. Reject when `FeatureFlag.isEnable` is false.
3. Apply user targeting and deterministic user or anonymous rollout.

Rollout and targeting stay user-based. The rollout hash uses `namespace:key:identifier`, which keeps each feature cohort independent. The namespace and feature key are typed against the first two levels of `FeatureFlagConfigSchemas`, so a misspelled pair fails at compile time.

### Configuration resolution

Platform and workspace resolution are separate typed methods:

- `resolvePlatformConfig(namespace, featureKey, configKey)` accepts every configuration and returns its platform value.
- `resolveWorkspaceConfig(workspaceId, namespace, featureKey, configKey)` accepts every configuration and returns the matching workspace override when one exists, otherwise the platform value.

Both methods resolve the feature through `FeatureFlagCache`; the cached aggregate includes all `FeatureFlagConfig` rows. They find the configuration by key and parse its platform value with the schema map. Workspace resolution then finds and parses an override when one exists, otherwise it returns the platform value.

The resolver returns the effective value and its source:

```typescript
type FeatureFlagConfigSource = 'platform' | 'workspace';
```

An invalid persisted value fails as server misconfiguration. The resolver never falls back silently.

### Effective feature availability

Feature availability is the result of one feature evaluation:

```text
FeatureFlag(namespace, key).isEnable is true
    AND
the caller is targeted or passes deterministic rollout
```

`@FeatureFlagProtected('<namespace>', '<feature>')` performs this evaluation. Configuration values never participate in the verdict. Platform and workspace configuration resolvers run separately where the available feature needs a parameter.

`FeatureFlag.isEnable = false` rejects every caller. Workspaces cannot replace, restrict, or bypass that status.

## Guard and Domain Enforcement

- `@FeatureFlagProtected('<namespace>', '<feature>')` applies feature availability, targeting, and rollout.
- `WorkspaceGuard` resolves and stores the workspace for policies and workspace configuration resolution. It does not alter feature availability.
- Policy guards run after feature availability checks. Feature availability is not authorization.

For example, `@FeatureFlagProtected('user', 'loginGoogle')` protects Google login, while `@FeatureFlagProtected('workspace', 'invitation')` protects workspace invitation operations.

Each provider flag governs both existing-user login and provider-assisted account creation. Enabling `user.loginGoogle` or `user.loginApple` therefore permits account creation through that provider without a separate `signUpAllowed` value. These provider flows do not evaluate `user.loginCredential` or `user.signUp`. Direct credential sign-up, password change, and forgot-password evaluate `user.signUp`, `user.changePassword`, and `user.forgotPassword`, respectively.

```typescript
@ProjectPolicyProtected({
    subject: EnumPolicySubject.Project,
    action: [EnumPolicyAction.read],
})
@FeatureFlagProtected('workspace', 'project')
@WorkspaceProtected()
@UserProtected()
@AuthJwtAccessProtected()
@ApiKeyProtected()
@Get('/list')
async list(): Promise<IResponsePaginationReturn<ProjectResponseDto>> { ... }
```

NestJS evaluates decorators bottom-up. The stack authenticates the user, stores the workspace, evaluates `workspace.project`, and then evaluates policies. Guards and owning domains use the same cache-backed evaluator, while queue, CLI, and internal callers invoke the domain directly.

Not every workspace-bound operation begins with `WorkspaceGuard`:

- Invite preview and claim evaluate `workspace.invitation` in the invite domain and resolve the workspace from the validated invite token for configuration and policy work.
- Invite-based sign-up evaluates `workspace.invitation` before onboarding.
- Join-request creation evaluates `workspace.joinRequest` and resolves the requested workspace independently.
- Workspace configuration resolution never trusts `x-workspace-id` directly. It uses the workspace resolved by `WorkspaceGuard` or by the owning domain flow.

| Feature                 | Gated operations                                                       | Cleanup still allowed                     |
| ----------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| `workspace.invitation`  | Create, resend, preview, claim, invite-based sign-up, list, and revoke | Expiry sweep                              |
| `workspace.joinRequest` | Create, list, accept, and reject                                       | Cancellation during workspace deletion    |
| `workspace.project`     | User-scope project operations                                          | Project cleanup during workspace deletion |

Disabling a feature closes its interactive operations but keeps lifecycle cleanup. Existing invitations and join requests remain stored and become manageable again when their flags are enabled. General workspace lifecycle operations are not feature-gated. Authentication, workspace membership, and policy controls continue to protect them.

### Invitation default expiry

`workspace / invitation / expiredInDays` supplies the default invite lifetime used by invite creation and resend when the request omits `expiryDuration`. A request that supplies `expiryDuration` keeps that explicit value. The resolver uses the target workspace, so a workspace override changes only that workspace's default.

### Analytic categories

Each analytic route family has an independent feature under the `analytic` namespace because `AnalyticAdminController` has no workspace context:

| Feature        | Controller routes           |
| -------------- | --------------------------- |
| `auth`         | `/analytic/auth/*`          |
| `users`        | `/analytic/users/*`         |
| `devices`      | `/analytic/devices/*`       |
| `workspaces`   | `/analytic/workspaces/*`    |
| `apiKeys`      | `/analytic/api-keys/*`      |
| `projects`     | `/analytic/projects/*`      |
| `termPolicies` | `/analytic/term-policies/*` |
| `fraud`        | `/analytic/fraud/*`         |
| `anomaly`      | `/analytic/anomaly/*`       |

The generic platform guard handles every category. For example, `@FeatureFlagProtected('analytic', 'users')` evaluates `analytic.users`. A disabled category rejects with `serviceUnavailable`.

```typescript
@PlatformPolicyProtected({
    subject: EnumPolicySubject.analytic,
    action: [EnumPolicyAction.read],
})
@FeatureFlagProtected('analytic', 'users')
@Get('/users/registrations')
async usersRegistrations(/* ... */): Promise</* ... */> { ... }
```

These platform routes resolve no workspace overrides because they carry no workspace context.

## Cache

- `FeatureFlag:{namespace}:{key}` stores one aggregate containing the `FeatureFlag`, all of its `FeatureFlagConfig` rows and platform values, and its user targets.
- `FeatureFlag:Workspace:{workspaceId}:Config:{namespace}:{key}` stores the workspace's configuration override rows for one feature.
- On a global cache miss, `FeatureFlagRepository.findOneByNamespaceAndKey` loads `targetUsers` and `configs` with the feature in one database query. `FeatureFlagCache.getByNamespaceAndKeyAndCache` stores and returns that complete aggregate.
- A global cache hit supplies `isEnable`, rollout, targeting, and platform configuration values. Configuration resolution does not issue a separate database query after that hit.
- Configuration owns the complete key patterns, filled through `HelperStringService.fillPattern`.
- Cache reads, writes, and deletes are best-effort. Read failures fall through to the database, and write or delete failures are logged without replacing the database result.
- A status, target, or platform-value mutation commits the database write and activity log, then attempts deletion of the global entry before returning the committed result.
- An override mutation commits the database write and activity log, then attempts deletion of the workspace-feature entry before returning the committed result.
- Invalidation runs after the database mutation, not concurrently with it through `Promise.all`. An invalidation failure does not reject the request.
- Workspace deletion relies on database cascade and cache TTL for any stale scoped entry.
- The effective value is computed from cached rows on every read, not cached as a verdict.
- Transactional configuration resolution reads through transaction-aware repositories and bypasses Redis.

## Lifecycle

### Seed

`src/migration/data/migration.feature-flag.data.ts` materializes the catalog. It lists each feature with its description, operational state, and configurations with their descriptions and initial values.

The file contains the complete namespaced feature catalog, including `workspace.invitation`, `workspace.joinRequest`, and `workspace.project`, with `workspace.invitation.expiredInDays = 7`, plus the nine analytic feature rows. General workspace operations have no feature row. New flags start enabled with full rollout and no targets.

```typescript
interface IFeatureFlagSeed<
    N extends FeatureFlagNamespace,
    F extends FeatureFlagKey<N>,
> {
    namespace: N;
    key: F;
    description: string;
    isEnable: boolean;
    rolloutPercent: number;
    configs: {
        key: FeatureFlagConfigKey<N, F>;
        description: string;
        value: unknown;
    }[];
}
```

The seed is idempotent whenever the owner invokes the seeding workflow:

- A missing `FeatureFlag` or `FeatureFlagConfig` is created from the seed entry.
- An existing row keeps its operator-set `isEnable`, `rolloutPercent`, targets, and `value`. The seed refreshes only `description`.
- Every seeded `value` is parsed through `getFeatureFlagConfigSchema` before writing. An unknown namespace, feature key, or configuration key fails the seed.
- A persisted feature or configuration missing from the seed is reported as an integrity failure and is not deleted.

### Workspace creation

Workspace creation writes no feature configuration data. A new workspace inherits platform values.

### Catalog changes

- Adding or removing a feature or configuration updates `FeatureFlagConfigSchemas` and `src/migration/data/migration.feature-flag.data.ts` in the same change. The seed materializes the complete final catalog for an empty database.

Catalog changes update the schema map, seed, enforcement call sites, and parity test together. Existing workspaces inherit a new platform value until an override is set.

## API

The feature-flag module owns these controllers, DTOs, and response contracts. Workspace-addressed routes delegate to `WorkspaceFeatureFlagDomain`.

### Platform administration

The list is a database read of features with their namespaces, keys, configurations, and platform values.

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

Each feature includes `namespace`, `key`, and its configurations. Each configuration includes `id`, `key`, `description`, and `value`. The member response exposes only the effective value; platform values and override sources are administrative details. Feature availability remains read-only and platform-controlled.

### Workspace override administration

Admin routes address the workspace in the path because admin scope does not use `x-workspace-id`. `WorkspaceFeatureFlagDomain` owns workspace validation and write orchestration.

| Method | Path                                                                                | Purpose                                                     |
| ------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| GET    | `/admin/feature-flag/workspaces/:workspaceId`                                       | List platform value, effective value, and source per config |
| PUT    | `/admin/feature-flag/workspaces/:workspaceId/configs/:featureFlagConfigId/override` | Create or replace one configuration override                |
| DELETE | `/admin/feature-flag/workspaces/:workspaceId/configs/:featureFlagConfigId/override` | Remove the override; the platform value applies again       |

PUT takes `{ value }` and is idempotent for the workspace and configuration pair. It rejects an unknown workspace or configuration. DELETE is also idempotent: a missing override is a successful no-op. Each mutation commits its database write and activity log, attempts cache invalidation, and returns the committed result even when cache deletion fails.

## Activity Log

Reads create no activity. Writes use these actions:

| Action                                          | Written by                | Metadata                                                                                |
| ----------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| `adminFeatureFlagConfigUpdate`                  | PATCH of a platform value | Namespace, feature key, configuration key, previous value, and resulting value          |
| `adminFeatureFlagConfigWorkspaceOverrideSet`    | PUT of an override        | Namespace, feature key, configuration key, optional previous value, and resulting value |
| `adminFeatureFlagConfigWorkspaceOverrideDelete` | DELETE of an override     | Namespace, feature key, configuration key, and removed value                            |

Metadata is flat and validated by a discriminated zod schema. Values are JSON-encoded. Configuration values exclude credentials and tokens, so they are safe to log. Config writes use `user: payload`; override writes also use `workspace: target`. Each state-changing mutation writes one action. A retry whose value already matches, or an idempotent DELETE that finds no override, writes no duplicate activity but still attempts cache invalidation. The existing status update keeps its current action.

## Status Codes

Reused from the existing `feature-flag` block:

- `notFound` (`50600`, 404) for an unknown `featureFlagId` on an admin path.
- `serviceUnavailable` (`50601`, 503) for a disabled feature or failed rollout or targeting.
- `predefinedKeyTypeInvalid` (`50605`, 500) when a persisted value does not match its schema.
- `predefinedKeyNotFound` (`50606`, 500) when a statically defined feature has no persisted row or a configuration row has no schema.

`configInvalid` (`50602`, 400) identifies a request value rejected by its configuration schema.

Added:

| member           | statusCode | HTTP | messagePath                        | Description                                                  |
| ---------------- | ---------: | ---: | ---------------------------------- | ------------------------------------------------------------ |
| `configNotFound` |    `50607` |  404 | `featureFlag.error.configNotFound` | The `featureFlagConfigId` does not identify a configuration. |

`predefinedKeyLengthExceeded` and `predefinedKeyEmpty` are removed. Namespace, feature, and configuration keys are supplied separately and validated against `FeatureFlagConfigSchemas`; the guard does not parse a composite key path.

## Out of Scope

These are deliberately left out of this design. The tables and schema map allow adding them later without breaking changes:

- **Runtime creation of features and configurations.** The catalog changes only through the seed.
- **Dated or scheduled overrides.** Add temporal columns and precedence rules only when a concrete scheduling requirement exists.
- **Workspace feature availability overrides.** `FeatureFlag.isEnable`, rollout, and user targets are platform-controlled. Workspace overrides apply only to feature configuration values.
- **Workspace-subject rollout and workspace targets.** Rollout and explicit targets stay user-based as they are today.
- **Project-level overrides.** A project-specific value uses a dedicated `FeatureFlagConfigProjectOverride` with required `projectId` and `featureFlagConfigId` foreign keys. Project resolution applies the project override, then the workspace override, then the platform value. `FeatureFlagConfigWorkspaceOverride` remains workspace-specific; neither model uses nullable scope foreign keys or a polymorphic scope identifier.
- **External flag services.** OpenFeature would not replace the application-owned catalog, validation, or precedence.

## Implementation Steps

Test-first, in this order:

1. Add `FeatureFlag.namespace`, the `FeatureFlagConfig` and `FeatureFlagConfigWorkspaceOverride` models, and the activity actions; remove `FeatureFlag.metadata`. Apply the schema as a breaking change without converting existing feature-flag rows or metadata. The owner applies it with `pnpm db:migrate`.
2. Define the three-level `FeatureFlagConfigSchemas`, `getFeatureFlagConfigSchema`, and the derived namespace, feature, configuration, and value types. Add the bidirectional seed/schema parity test, including flags with empty configuration maps.
3. Replace the catalog in `src/migration/data/migration.feature-flag.data.ts` with the namespaced final catalog, including `workspace.invitation`, `workspace.joinRequest`, and `workspace.project`, `workspace.invitation.expiredInDays = 7`, and the nine analytic flags. Keep the seed idempotent: create missing rows, refresh descriptions only, validate every value, and report orphaned rows.
4. Extend `FeatureFlagRepository.findOneByNamespaceAndKey` to load `targetUsers` and every `FeatureFlagConfig` row in one query. Cache that aggregate under `FeatureFlag:{namespace}:{key}`, add the workspace configuration-override cache, add transaction-aware workspace configuration resolution, and make every cache read, write, and delete best-effort with logged failures.
5. Add exceptions, status codes, and i18n messages. Rename `invalidMetadata` to `configInvalid`.
6. Add the platform and workspace configuration resolvers and the configuration update and idempotent override set and delete methods. All writes commit the database work before attempting best-effort cache deletion.
7. Make `@FeatureFlagProtected` and the domain evaluator accept a typed namespace-feature pair. Hash rollout with `namespace:key:identifier`. Remove metadata and configuration gating from availability evaluation.
8. Map user flows to independent flags. Existing-user login and provider-assisted account creation both evaluate `user.loginGoogle` or `user.loginApple` for the selected provider. Neither provider flag depends on `user.loginCredential` or `user.signUp`. Credential sign-up, password change, and forgot-password evaluate their own flags.
9. Enforce `workspace.invitation` and `workspace.joinRequest` across their complete interactive flows. Replace the `workspace.invite.expiredInDays` runtime config with `workspace.invitation.expiredInDays`, resolved when invite creation or resend omits `expiryDuration`. Keep expiry and workspace-deletion cleanup available.
10. Protect project routes with `@FeatureFlagProtected('workspace', 'project')`.
11. Apply `@FeatureFlagProtected('analytic', '<feature>')` to each of the nine corresponding `AnalyticAdminController` route families.
12. Leave general workspace operations without a feature flag. Invitation, join-request, and project flows evaluate their own flags without implicit parent evaluation. Replace the metadata update route and `checkMetadataKey` with configuration update by ID. Make the admin list a database read of namespaced features and configurations.
13. Add the workspace configuration DTOs, controllers, and user route. They expose and mutate configuration values only; feature availability remains platform-controlled. Verify the module wiring has no cycle.
14. Update [Feature Flag][ref-doc-feature-flag], [Workspace][ref-doc-workspace], [Activity Log][ref-doc-activity-log], and [Status Codes][ref-doc-status-codes] after the runtime implementation lands.

<!-- REFERENCES -->

[ref-doc-feature-flag]: ../feature-flag.md
[ref-doc-workspace]: ../workspace.md
[ref-doc-request-validation]: ../request-validation.md
[ref-doc-database]: ../database.md
[ref-doc-activity-log]: ../activity-log.md
[ref-doc-status-codes]: ../status-codes.md
