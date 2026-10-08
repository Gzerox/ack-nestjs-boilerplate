# Workspace Feature Flag Configuration

Status: proposed. Nothing in this document is implemented yet.

## Overview

`FeatureFlag` is the seeded feature catalog and the platform operational control. Each flag declares one rollout subject and can declare typed configuration through seeded `FeatureFlagConfig` rows. A workspace customizes a configuration with sparse `FeatureFlagWorkspaceOverride` rows. One undated row can hold its standing value, while dated rows can replace that value for bounded or open-ended periods.

The global flag and the scoped configuration answer different questions:

- `FeatureFlag.isEnable` controls whether the platform exposes the feature at all. It remains the global kill switch and outranks rollout and targeting.
- `FeatureFlag.rolloutSubject` determines whether rollout and explicit targeting use a user or a workspace.
- A `FeatureFlagConfig` with key `enabled` declares the platform scoped entitlement. A workspace override may change that value for one workspace.
- Other configuration keys describe limits or behavior such as `maxProjects`.

For an operation designated for full scoped evaluation, effective feature availability requires the global flag evaluation and the resolved scoped `enabled` value to pass. A workspace override never bypasses `FeatureFlag.isEnable`.

Goals:

1. Keep feature identity, global availability, rollout subject, targeting, and configuration definitions in one seeded catalog.
2. Let a workspace keep a standing override and schedule non-overlapping dated overrides that restore the standing or platform value when they expire.
3. Return every feature and configuration with its platform value, effective value, and effective source.
4. Add workspace-scoped feature configurations without changing the override schema or adding one table per feature.

Access:

- Platform administrators read the complete feature and configuration catalog and update existing global controls and platform configuration values.
- Every member of a workspace reads that workspace's effective feature configuration.
- Only a platform administrator creates, replaces, or removes workspace overrides.

## Related Documents

- [Feature Flag][ref-doc-feature-flag] - global evaluation, rollout, and targeting behavior
- [Workspace][ref-doc-workspace] - the tenancy boundary and `x-workspace-id` selection
- [Database][ref-doc-database] - Prisma conventions and seeding
- [Activity Log][ref-doc-activity-log] - action contracts
- [Status Codes][ref-doc-status-codes] - the `feature-flag` block and existing workspace errors

## Table of Contents

- [Decisions](#decisions)
- [Data Model](#data-model)
- [Feature Registry](#feature-registry)
- [Evaluation](#evaluation)
- [Rollout and Targeting](#rollout-and-targeting)
- [Guard and Domain Enforcement](#guard-and-domain-enforcement)
- [Cache](#cache)
- [Lifecycle](#lifecycle)
- [API](#api)
- [Activity Log](#activity-log)
- [Status Codes](#status-codes)
- [Future Scopes](#future-scopes)
- [Implementation Steps](#implementation-steps)

## Decisions

### FeatureFlag is the catalog root

`FeatureFlag` remains the canonical seeded feature identity. Its `key`, `description`, and `rolloutSubject` identify the feature and its evaluation context. `isEnable`, `rolloutPercent`, and the matching target relation provide the mutable operational controls.

Configuration definitions are normalized children of the flag:

- `FeatureFlagConfig` declares one supported configuration key, its description, and its mutable platform value.
- `FeatureFlagWorkspaceOverride` stores workspace-specific standing and dated replacements for one configuration definition.

`FeatureFlag` carries no configuration metadata. Configuration keys such as `signUpAllowed`, `forgotAllowed`, `enabled`, and `maxProjects` are `FeatureFlagConfig` rows attached to their flags.

Feature flags and configuration definitions have no create or delete administration endpoints. The seed owns their identities, keys, descriptions, rollout subjects, and schemas. Platform administrators can update `FeatureFlag.isEnable`, `rolloutPercent`, the targets matching the rollout subject, and the `value` of an existing `FeatureFlagConfig`. They cannot introduce arbitrary flags or configuration keys or change a feature's rollout subject.

### Definitions are global and overrides are scoped

`FeatureFlagConfig` is not scoped. It defines the complete configuration catalog and its current platform value.

Scope belongs to `FeatureFlagWorkspaceOverride`. A workspace override references one definition and one workspace. An active dated override wins over the workspace's undated override. With neither, the definition's platform `value` is effective.

For example:

```text
FeatureFlag: project, isEnable = true
  FeatureFlagConfig: enabled, value = true
  FeatureFlagConfig: maxProjects, value = 10

Workspace A standing override: enabled = false
Workspace B standing override: maxProjects = 25
Workspace B dated override: maxProjects = 50, valid for June
```

The effective values are `enabled = false` and `maxProjects = 10` for Workspace A. Workspace B resolves `enabled = true` and `maxProjects = 50` during June, then returns to its standing `maxProjects = 25` value.

### Sparse overrides

Workspace creation inserts no configuration rows. An override exists only when the workspace differs from the current platform value or schedules a dated value.

Sparse rows provide these properties:

- Adding a feature or configuration definition needs no workspace backfill.
- Removing an undated override immediately restores the platform value when no dated override is active.
- An expired dated override restores the undated workspace value, or the current platform value when no undated row exists.
- Future and expired dated rows do not affect the effective value.
- Each override has its own audit and nullable validity fields.

### Module ownership

The feature-flag module is the catalog, evaluation, and HTTP contract owner. It owns `FeatureFlag`, rollout targets, `FeatureFlagConfig`, and `FeatureFlagWorkspaceOverride`, including their repositories, registry fragments, aggregate registry, validation, resolution, and cache behavior. Its global domain module exports the catalog evaluator and configuration resolver. Its HTTP module owns the platform and workspace-scoped controllers, HTTP services, request and response DTOs, and Swagger contracts. Workspace scope in a route path does not transfer HTTP ownership to the workspace module.

The workspace module owns workspace selection, membership, policies, the `WorkspaceFeatureFlagProtected` composition, and `WorkspaceFeatureFlagDomain`. The domain validates and locks the target workspace, then calls transaction-aware methods on the exported feature-flag domain. `WorkspaceDomainModule` exports this orchestration domain but never imports `FeatureFlagRepositoryModule` or issues queries against feature-flag models.

`FeatureFlagHttpModule` imports `WorkspaceDomainModule`. `FeatureFlagWorkspaceHttpService` delegates active-workspace reads to `FeatureFlagDomain` after the workspace guards have resolved the subject, and delegates admin reads and writes addressed by `workspaceId` to `WorkspaceFeatureFlagDomain`. `FeatureFlagDomainModule` does not import `WorkspaceDomainModule` or `ProjectDomainModule`, which keeps the global dependency direction acyclic.

The project and analytic modules own enforcement for their capabilities. They call the exported feature-flag domain with a resolved workspace ID; they do not own override persistence. The `FeatureFlagProjectRegistry` name identifies a catalog fragment, not project-scoped storage. Project configuration continues to resolve through `FeatureFlagWorkspaceOverride` until per-project values are introduced.

This boundary follows the existing cross-cutting modules. The feature-flag module owns its records in the same way that activity-log owns `ActivityLog`, including rows related to a workspace. Workspace, project, and analytic domains compose exported domains in the same way that analytic orchestration composes the exported analytic domains of data-owning modules.

### Naming convention

Names begin with the module that owns the artifact, followed by its scope or capability and then its role:

| Owner          | Names                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature-flag` | `FeatureFlagWorkspaceOverride`, `FeatureFlagWorkspaceRegistry`, `FeatureFlagProjectRegistry`, `FeatureFlagWorkspaceHttpService`, `FeatureFlagCache` |
| `workspace`    | `WorkspaceFeatureFlagDomain`, `WorkspaceFeatureFlagProtected`                                                                                       |
| `project`      | Project-owned enforcement remains in `ProjectDomain`; no project override artifact exists in this design                                            |

Prisma models, repositories, registry constants, cache entries, exceptions, activity actions, DTOs, controllers, and HTTP services for the feature-flag aggregate therefore use the `FeatureFlag...` prefix. Workspace-owned guards and domain orchestration use the `WorkspaceFeatureFlag...` prefix. A future project-scoped override is named `FeatureFlagProjectOverride` when that model becomes part of the feature-flag aggregate.

## Data Model

### FeatureFlag

The `FeatureFlag` model contains:

| Field            | Type                  | Notes                                                          |
| ---------------- | --------------------- | -------------------------------------------------------------- |
| `id`             | uuid                  | `uuidv7()` default                                             |
| `key`            | string                | Seeded unique feature key                                      |
| `description`    | string                | Seeded feature description                                     |
| `isEnable`       | boolean               | Global kill switch                                             |
| `rolloutPercent` | integer               | Global deterministic rollout                                   |
| `rolloutSubject` | `user` or `workspace` | Seed-owned subject used for targeting and percentage bucketing |
| audit fields     |                       | Existing audit fields                                          |

The model has no `metadata` field. Its `configs` relation points to `FeatureFlagConfig`. `targetUsers` and `targetWorkspaces` provide explicit targets for the corresponding rollout subject.

### Rollout targets

Targeting uses typed relations with database foreign keys:

| Model                  | Fields                               | Constraints                                                                       |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `FeatureFlagUser`      | `id`, `featureFlagId`, `userId`      | Unique on `(featureFlagId, userId)`; both relations cascade on hard deletion      |
| `FeatureFlagWorkspace` | `id`, `featureFlagId`, `workspaceId` | Unique on `(featureFlagId, workspaceId)`; both relations cascade on hard deletion |

Only the relation matching `FeatureFlag.rolloutSubject` may contain rows. Each flag has at most 100 explicit targets. Target rows are operational rollout state, not authorization or entitlement records.

### FeatureFlagConfig

`FeatureFlagConfig`, table `feature_flag_configs`:

| Field                                              | Type   | Notes                                                                  |
| -------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| `id`                                               | uuid   | `uuidv7()` default                                                     |
| `featureFlagId`                                    | uuid   | FK to `FeatureFlag`, `onDelete: Cascade`                               |
| `key`                                              | string | Seeded configuration key                                               |
| `description`                                      | string | Seeded configuration description                                       |
| `value`                                            | json   | Current platform value, initialized from and validated by the registry |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` |        | Audit fields                                                           |

- `@@unique([featureFlagId, key])`
- `@@index([featureFlagId])`

### FeatureFlagWorkspaceOverride

`FeatureFlagWorkspaceOverride`, table `feature_flag_workspace_overrides`:

| Field                                              | Type               | Notes                                             |
| -------------------------------------------------- | ------------------ | ------------------------------------------------- |
| `id`                                               | uuid               | `uuidv7()` default                                |
| `featureFlagConfigId`                              | uuid               | FK to `FeatureFlagConfig`, `onDelete: Cascade`    |
| `workspaceId`                                      | uuid               | FK to `Workspace`, `onDelete: Cascade`            |
| `value`                                            | json               | Replacement validated by the configuration schema |
| `validFrom`                                        | datetime, nullable | Inclusive start                                   |
| `validTo`                                          | datetime, nullable | Exclusive end                                     |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` |                    | Audit fields                                      |

- `@@index([workspaceId, featureFlagConfigId])`

The database distinguishes undated and dated overrides from their validity fields. It stores no override kind or priority:

- A partial unique index on `(featureFlagConfigId, workspaceId)` where both validity fields are null permits at most one undated override.
- A PostgreSQL GiST exclusion constraint on `featureFlagConfigId`, `workspaceId`, and `tstzrange(validFrom, validTo, '[)')` rejects overlapping dated overrides. Its predicate includes rows where either validity field is non-null.
- The exclusion constraint uses the `btree_gist` extension for UUID equality and is added through the customized Prisma migration.

Validity rules:

- Both dates null identifies the undated workspace override.
- Either date populated identifies a dated override. A null bound leaves that side open.
- A null `validFrom` with a populated `validTo` applies immediately and expires at `validTo`.
- A populated `validFrom` with a null `validTo` begins at `validFrom` and remains effective until an administrator ends or replaces it.
- When both dates are set, `validTo` is later than `validFrom`.
- Windows are half-open, `[validFrom, validTo)`, and compared in UTC.
- Dated overrides for the same workspace and configuration never overlap, so at most one can be active at an instant.
- Expired dated rows are immutable history. Future rows can be edited or cancelled before their start.
- Window activation and expiration create no notification or activity entry.
- Soft-deleting a workspace keeps its overrides. Hard deletion cascades to them.

## Feature Registry

`FeatureFlagRegistry` is the aggregate compile-time contract for seeded flags and configuration definitions. Capability-specific fragments keep each definition focused while the aggregate remains the only catalog consumed by seeding, validation, and evaluation. Each configuration declares a description, Zod schema, and initial default. The excerpt shows the workspace and project fragments introduced by this design; the aggregate also includes the registry fragments that replace the existing identity and account seed entries.

```typescript
export const FeatureFlagWorkspaceRegistry = {
    description: 'Core workspace access and management',
    rolloutSubject: 'user',
    configs: {
        invitation: {
            description: 'Workspace invitations and invite acceptance',
            schema: z.boolean(),
            default: true,
        },
        joinRequest: {
            description: 'Requests to join public workspaces',
            schema: z.boolean(),
            default: true,
        },
        analytic: {
            description: 'Workspace-scoped analytics',
            schema: z.boolean(),
            default: true,
        },
    },
} as const satisfies IFeatureFlagDefinition;

export const FeatureFlagProjectRegistry = {
    description: 'Project management inside a workspace',
    rolloutSubject: 'workspace',
    configs: {
        enabled: {
            description: 'Whether project management is available',
            schema: z.boolean(),
            default: true,
        },
        maxProjects: {
            description: 'Maximum projects in a workspace',
            schema: z.number().int().positive(),
            default: 10,
        },
    },
} as const satisfies IFeatureFlagDefinition;

export const FeatureFlagRegistry = mergeFeatureFlagRegistries(
    FeatureFlagAuthRegistry,
    FeatureFlagUserRegistry,
    {
        workspace: FeatureFlagWorkspaceRegistry,
        project: FeatureFlagProjectRegistry,
    }
);
```

- `FeatureFlagWorkspaceRegistry` and `FeatureFlagProjectRegistry` each declare one rootless feature definition. `FeatureFlagRegistry` assigns their persisted `workspace` and `project` keys while assembling the complete catalog.
- `FeatureFlagRegistry` is the single merged source for derived feature keys, seeding, boot integrity checks, and runtime lookup.
- `mergeFeatureFlagRegistries` preserves the fragments' literal key types and rejects duplicate feature keys during initialization instead of allowing object spread to overwrite one silently.
- Feature and configuration keys are camelCase and derived as TypeScript types from the registry.
- A rollout subject is part of the feature's semantics and is not administrator-editable.
- The seed creates missing `FeatureFlagConfig` rows with the registry default. On later runs, it updates seed-owned descriptions while preserving administrator-edited platform values.
- The Zod schema validates every registry default, platform-value update, override write, and persisted value read.
- A boot check verifies that persisted flags and configurations match the registry. A missing or unknown definition is a server misconfiguration.
- Administrators cannot introduce arbitrary flags or configuration keys.
- A flag declares `enabled` only when it supports scoped availability. The core `workspace` flag has no scoped `enabled` configuration because workspace listing, creation, switching, and invite or join entry points do not consistently begin with an active workspace.

### Initial feature catalog

| Feature     | Subject   | Scoped configuration                    | Owned capability                                                                                                |
| ----------- | --------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `workspace` | user      | `invitation`, `joinRequest`, `analytic` | Workspace listing, creation, switching, core management, membership, ownership, and public workspace visibility |
| `project`   | workspace | `enabled`, `maxProjects`                | Project and project-membership operations inside a workspace                                                    |

The following are not separate features:

- Membership, ownership transfer, leaving, deletion, roles, and switching are core workspace lifecycle behavior. Splitting them could leave a workspace in an unmanageable state.
- Public visibility remains workspace data through `Workspace.isPublic`. Disabling join requests does not hide a public workspace preview.
- Invite expiry remains operational cleanup and runs regardless of scoped configuration.

Scoped disablement preserves cleanup paths:

- `workspace.configs.invitation = false` rejects create, resend, preview, claim, invite-based sign-up, list, and revoke. Expiry processing remains active.
- `workspace.configs.joinRequest = false` rejects create, list, accept, and reject. Workspace deletion still cancels pending requests.
- `project.enabled = false` and `workspace.configs.analytic = false` reject their complete user-scope surfaces.
- `maxProjects` is checked only when creating a project. Lowering it below the existing count does not remove or disable existing projects.

Existing invitations and join requests remain stored while their mechanism is disabled. They become manageable again when the configuration is enabled; only expiry and workspace-deletion cleanup continue while it is disabled.

## Evaluation

### Global feature evaluation

`@FeatureFlagProtected('<key>')` and `FeatureFlagGuard` provide the controller-level global check:

1. Resolve the seeded flag by key.
2. Reject when `FeatureFlag.isEnable` is false.
3. For a user-subject flag, apply explicit-user targeting and deterministic user or anonymous rollout.
4. For a workspace-subject flag, defer targeting and percentage rollout until the owning guard or domain has resolved the workspace.
5. Allow the request to continue when the applicable evaluation passes.

The global kill switch remains independent from workspace configuration and always runs first. A workspace-subject feature cannot be fully evaluated from an untrusted header alone.

### Configuration resolution

A workspace configuration resolves as follows:

1. Resolve the `FeatureFlagConfig` by feature key and configuration key.
2. Find the workspace's active dated override for that definition using the current database time.
3. Use and validate that dated value when it exists.
4. Otherwise find and validate the workspace's undated override.
5. Otherwise use and validate `FeatureFlagConfig.value`.

The resolver returns the effective value and its source:

```typescript
type FeatureFlagConfigSource = 'platform' | 'workspace';
```

An invalid persisted platform or selected override value is a server misconfiguration and fails resolution instead of silently substituting another value. A dated override is active when `validFrom` is null or not later than the current time, and `validTo` is null or later than the current time. Window checks run against the current time on every resolution; the cache never stores an effective verdict.

### Effective feature availability

Routes protected at workspace scope resolve the optional `enabled` configuration after the global guard passes:

```text
global FeatureFlag evaluation passes
    AND
resolved workspace enabled configuration is true
```

`FeatureFlag.isEnable = false` rejects every workspace regardless of overrides. A false workspace override disables only that workspace. An inactive dated override falls through to the undated workspace value and then to the current platform `enabled` value.

Boolean configuration keys used as gates reject `false` with `serviceUnavailable` and reject a non-boolean registry definition with `predefinedKeyTypeInvalid`.

## Rollout and Targeting

Each feature has exactly one registry-owned rollout subject. The evaluator hashes `featureKey:subjectId` with SHA-256, converts the first eight hexadecimal characters to an integer, and uses modulo 100 to produce a stable bucket from 0 to 99.

Evaluation order is fixed:

1. `FeatureFlag.isEnable = false` denies every subject.
2. A matching explicit target passes rollout.
3. Otherwise the stable bucket must be lower than `rolloutPercent`.
4. For workspace-scoped behavior, the resolved configuration must also permit the operation.

User-subject flags use the authenticated user ID. An anonymous request uses the validated anonymous ID only when rollout is below 100 percent; a missing or invalid identifier fails closed. The anonymous ID is client-controlled and therefore suitable only for exposure control, never authorization or entitlement.

Workspace-subject flags use the resolved workspace ID. Every member of the same workspace receives the same rollout result. A workspace target bypasses percentage rollout but does not bypass the global kill switch or a scoped false configuration.

Targeting is intentionally limited:

- User flags support user targets and workspace flags support workspace targets. A target of the wrong type is rejected.
- Target lists contain at most 100 rows per flag. Percentage rollout represents larger cohorts.
- Rollout percentages and targets have no validity windows. Scheduled workspace behavior uses configuration override windows.
- Roles, countries, arbitrary attributes, deny lists, combined user-and-workspace evaluation, and expression rules are outside this design.
- A project inside a selected workspace follows its workspace decision. Project-subject rollout is added only with a concrete requirement.

The evaluator returns an internal decision containing `allowed`, `reason`, `subject`, and the optional bucket. Guards map a denied decision to the existing public service-unavailable response. Structured logs and metrics use the feature key, subject type, and reason without recording user or workspace IDs.

OpenFeature is not part of this implementation. It could standardize a provider API, but it would not remove the application-owned registry, persistence, subject resolution, precedence, or scoped configuration behavior.

## Guard and Domain Enforcement

The global and scoped checks remain separate:

- `@FeatureFlagProtected('<key>')` applies the global kill switch. It also applies rollout for a user-subject flag because authentication has already resolved that subject.
- `@WorkspaceFeatureFlagProtected('<key>')` evaluates explicit workspace targeting, workspace percentage rollout, and the feature's `enabled` configuration for the active workspace.
- `WorkspaceFeatureFlagProtected` remains workspace-owned because it composes workspace resolution with feature-flag evaluation; HTTP endpoint ownership does not change that guard boundary.
- `WorkspaceGuard` resolves and stores the workspace before the workspace feature guard runs.
- Policy guards run after feature availability checks. Feature availability is not authorization.

```typescript
@ProjectPolicyProtected({
    subject: EnumPolicySubject.Project,
    action: [EnumPolicyAction.read],
})
@WorkspaceFeatureFlagProtected('project')
@WorkspaceProtected()
@UserProtected()
@FeatureFlagProtected('project')
@AuthJwtAccessProtected()
@ApiKeyProtected()
@Get('/list')
async list(): Promise<IResponsePaginationReturn<ProjectResponseDto>> { ... }
```

NestJS evaluates the decorators bottom-up. The exact stack evaluates the global kill switch after authentication, stores the workspace, evaluates workspace rollout and configuration, and then evaluates policies.

The workspace guard calls the same feature-flag evaluation domain used by owning domains. The decision and resolved configuration are stored in the request store and reused during the request. Domain workflows call the resolver directly, so queue, CLI, and internal callers enforce the same scoped availability without depending on an HTTP decorator.

Not every workspace-bound operation begins with `WorkspaceGuard`:

- Invite preview and claim resolve the workspace from the validated invite token, then evaluate `workspace.configs.invitation` in the invite domain.
- Invite-based sign-up resolves the invite workspace before onboarding and evaluates the same feature there.
- Join-request creation resolves the requested workspace before evaluating `workspace.configs.joinRequest`.
- No evaluator trusts `x-workspace-id` until `WorkspaceGuard` has resolved it.

The route and domain coverage is:

| Feature                         | Full scoped evaluation                                                 | Ungated cleanup                                                |
| ------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `workspace.configs.invitation`  | Create, resend, preview, claim, invite-based sign-up, list, and revoke | Expiry sweep                                                   |
| `workspace.configs.joinRequest` | Create, list, accept, and reject                                       | Cancellation during workspace deletion                         |
| `project`                       | Every user-scope project operation                                     | Workspace deletion still soft-deletes projects transactionally |
| `workspace.configs.analytic`    | Every user-scope workspace analytic operation                          | none                                                           |

Scoped disablement closes the complete interactive mechanism while preserving lifecycle cleanup. Setting the feature's global `isEnable` to false remains an emergency kill switch and closes all guarded synchronous surfaces.

Non-boolean settings are resolved in the owning domain. Numeric limits are read and enforced inside the transaction that performs the related write.

For count-based limits such as `maxProjects`, reading a count and then inserting is not sufficient because two concurrent transactions can both observe the same remaining capacity. The owning domain uses this sequence:

1. Start a PostgreSQL transaction.
2. Lock the workspace row with `SELECT ... FOR UPDATE` so competing limit-enforced writes for that workspace serialize.
3. Resolve the platform value and active workspace override directly through transaction-aware repository methods, bypassing Redis.
4. Count the current resources and reject when the new write would exceed the resolved limit.
5. Create the resource and commit the transaction.

This keeps concurrency control in the domain that owns the resource and avoids a generic quota subsystem. A platform-value or override update affects operations that acquire the workspace lock after that update commits; it does not retroactively cancel an already-running operation.

## Cache

- Global flag and definition key: `FeatureFlag:{key}`. The cached flag includes its configuration definitions and the target relation matching its rollout subject.
- Workspace override key: `FeatureFlag:Workspace:{workspaceId}:Override:{featureKey}`. The cached value contains raw override rows and dates for that feature.
- The scope-first hierarchy groups a workspace's entries under `FeatureFlag:Workspace:{workspaceId}:Override:*`. Hard workspace deletion purges that pattern after the database commit. A future project override uses the parallel `FeatureFlag:Project:{projectId}:Override:{featureKey}` pattern.
- The feature-flag config owns separate complete patterns for the global flag and workspace override keys. The workspace pattern is filled with `HelperStringService.fillPattern`; it is not built by appending segments to the global pattern.
- Reads are cache-through and best-effort. Cache failures are logged and fall through to the database.
- Updating global operational state deletes the global flag entry.
- Replacing explicit targets deletes the global flag entry after the database transaction commits.
- Updating a platform configuration value deletes the global flag entry containing its definitions.
- Creating, updating, replacing, ending, or removing a workspace override deletes that workspace-feature override entry.
- Validity windows and effective sources are evaluated on every read.

## Lifecycle

### Seeding the catalog

The feature-flag seed inserts or updates each registered `FeatureFlag` and its `FeatureFlagConfig` definitions in one transaction. It creates missing rows with registry defaults, preserves existing `FeatureFlag.isEnable`, `rolloutPercent`, targets, and `FeatureFlagConfig.value`, and updates seed-owned descriptions, rollout subjects, and structure. The matching remove path deletes the seeded catalog and cascades to definitions, targets, and overrides.

Configuration definitions include the values represented by `signUpAllowed` and `forgotAllowed`. Invitation and join-request availability are represented by the `workspace.configs.invitation` and `workspace.configs.joinRequest` configurations. Runtime administration can update persisted platform values but cannot change keys or schemas.

No metadata data migration or backfill is required. The schema change removes `FeatureFlag.metadata`, and the updated seed creates the normalized configuration rows from registry defaults. Any administrator-edited metadata values are intentionally discarded. The required rollout-subject column initially defaults to `user` for existing rows, and the seed then applies each registry subject. The owner applies the schema before running the seed; runtime deployment follows only after both steps complete.

### Workspace creation

Workspace creation writes no feature configuration data. Every workspace inherits platform values until an administrator creates an undated or dated override.

### Adding a feature

Adding a registry feature adds its seeded `FeatureFlag` and configuration definitions. Existing workspaces inherit its platform values without a backfill.

### Adding a configuration key

Adding a registered configuration creates its seeded definition with the registry default as its initial platform value. Every workspace immediately resolves that value unless an override is later created.

### Removing a configuration key

Removing a seeded definition deletes its override rows through the foreign-key cascade. The registry and persisted catalog remain identical after the seed is applied.

## API

The feature-flag module owns every controller, HTTP service, DTO, and response contract in this section. Both `FeatureFlagAdminController` and `FeatureFlagUserController` use `/feature-flag` as their controller-level path. Workspace scope appears below that capability root. Both controllers delegate workspace-scoped translation through `FeatureFlagWorkspaceHttpService`.

### Platform administration

The feature-flag list exposes the seeded catalog, rollout subject, explicit target IDs, and current platform values:

| Method | Path                                                    | Purpose                                                                |
| ------ | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/admin/feature-flag/list`                              | List flags with their configuration definitions and platform values    |
| PATCH  | `/admin/feature-flag/update/:featureFlagId/status`      | Update `isEnable` and `rolloutPercent`                                 |
| PUT    | `/admin/feature-flag/update/:featureFlagId/targets`     | Replace the complete target set matching the feature's rollout subject |
| PATCH  | `/admin/feature-flag/update/:featureFlagId/config/:key` | Update one existing platform configuration value                       |

The target body contains `targetIds`. An empty array clears targeting. The domain rejects duplicate IDs, more than 100 targets, unknown users or workspaces, and targets whose type does not match the registry rollout subject. Replacement runs transactionally and invalidates the global cache after commit.

The configuration update validates `value` against the registry schema and invalidates the global feature cache. There are no runtime endpoints to create or delete flags, create or delete configuration definitions, change their keys, schemas, or rollout subjects, or update metadata.

### Workspace member

The feature-flag user controller exposes one route gated by the existing workspace protection and open to every member of the active workspace:

| Method | Path                           | Purpose                                                                 |
| ------ | ------------------------------ | ----------------------------------------------------------------------- |
| GET    | `/user/feature-flag/workspace` | List all features with effective configuration for the active workspace |

Each configuration response includes `key`, `description`, `platformValue`, `effectiveValue`, `source`, and the selected override when one is effective. The override contains `id`, `value`, `validFrom`, and `validTo`. Future and expired rows are administration history and are not returned to workspace members.

### Workspace override administration

The feature-flag admin controller addresses the workspace by path because admin scope does not use `x-workspace-id`. It delegates workspace validation, row locking, and write orchestration to `WorkspaceFeatureFlagDomain`:

| Method | Path                                                                                            | Purpose                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/admin/feature-flag/workspace/:workspaceId`                                                    | List effective configuration, the undated override, and dated override history for a workspace |
| PUT    | `/admin/feature-flag/workspace/:workspaceId/:featureFlagId/config/:key`                         | Set or replace the undated workspace override                                                  |
| DELETE | `/admin/feature-flag/workspace/:workspaceId/:featureFlagId/config/:key`                         | Remove the undated override                                                                    |
| POST   | `/admin/feature-flag/workspace/:workspaceId/:featureFlagId/config/:key/override`                | Create a dated override                                                                        |
| PATCH  | `/admin/feature-flag/workspace/:workspaceId/:featureFlagId/config/:key/override/:overrideId`    | Update a future dated override                                                                 |
| DELETE | `/admin/feature-flag/workspace/:workspaceId/:featureFlagId/config/:key/override/:overrideId`    | Cancel a future override or end an active override                                             |
| POST   | `/admin/feature-flag/workspace/:workspaceId/:featureFlagId/config/:key/override/replace-active` | Atomically replace the active dated override                                                   |

The undated PUT body contains only `value`. Dated create and future-update bodies contain `value`, `validFrom`, and `validTo`, with at least one validity field populated. An ordinary create or update that overlaps another dated row is rejected.

Deleting a future row removes it. Deleting an active row changes its `validTo` to the transaction timestamp, which preserves its effective history. An expired row cannot be changed or deleted.

Active replacement captures one database timestamp, ends the current dated row at that timestamp, and inserts the replacement with the same timestamp as `validFrom`. Its body contains `value` and nullable `validTo`; a null `validTo` makes the replacement open-ended. The operation rejects a replacement that overlaps a separate future row.

Every override write locks the workspace row with PostgreSQL `FOR UPDATE`, runs transactionally, and leaves the exclusion constraint as the final concurrency guard. Cache invalidation follows the commit.

## Activity Log

Reads create no activity. Platform target and configuration writes retain their specific actions. Workspace override writes use one action per CRUD result:

| Action                                    | Written by                                                | Metadata                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `adminFeatureFlagTargetsUpdate`           | PUT replacing explicit targets                            | Feature key, rollout subject, previous target count, and resulting target count                                   |
| `adminFeatureFlagConfigUpdate`            | PATCH of a platform configuration value                   | Feature key, configuration key, previous value, and resulting value                                               |
| `adminFeatureFlagWorkspaceOverrideCreate` | First undated PUT, dated POST, or active replacement POST | Operation, feature and configuration keys, override IDs, and resulting override snapshot                          |
| `adminFeatureFlagWorkspaceOverrideUpdate` | Existing undated PUT or future dated PATCH                | Operation, feature and configuration keys, override ID, and previous and resulting snapshots                      |
| `adminFeatureFlagWorkspaceOverrideDelete` | Undated DELETE, future cancellation, or active end        | Operation, feature and configuration keys, override ID, previous snapshot, and resulting end date when applicable |

The workspace override actions use a required string `operation` to distinguish the path represented by the row:

- Create: `standing`, `scheduled`, or `replaceActive`.
- Update: `standing` or `scheduled`.
- Delete: `standing`, `cancelScheduled`, or `endActive`.

Override metadata is flat. It carries `featureKey`, `configKey`, `overrideId`, and the operation-specific identifiers. Active replacement also carries `previousOverrideId`. Values are stored as `previousValueJson` and `resultingValueJson` so every registry-supported value has one activity shape. Window changes use `previousValidFrom`, `previousValidTo`, `resultingValidFrom`, and `resultingValidTo`; a field absent from that operation is omitted. Each action has a discriminated Zod metadata schema that requires the fields used by every supported operation variant.

The platform target and configuration actions use `user: payload`. Workspace override actions additionally use `workspace: target`, so they appear in the affected workspace's activity list. One administrative request writes one workspace override action, including active replacement. Natural activation and expiration write no activity because no administrative action occurs at those boundaries.

## Status Codes

The feature reuses `feature-flag` errors for catalog and gate evaluation:

- `serviceUnavailable` (`50601`, 503) for a failed global flag or a resolved false gate.
- `predefinedKeyNotFound` (`50606`, 500) for a registry or persisted catalog mismatch.
- `predefinedKeyTypeInvalid` (`50605`, 500) when a persisted platform or override value does not match its registry schema.
- `configInvalid` (`50602`, 400) replaces `invalidMetadata` and identifies an unknown configuration key or a value rejected by its registry schema.
- The existing feature-flag not-found error for an unknown `featureFlagId` on an admin path.

The feature-flag block gains:

| member                  | statusCode | HTTP | messagePath                               | Description                                                                                      |
| ----------------------- | ---------: | ---: | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `rolloutSubjectInvalid` |    `50607` |  500 | `featureFlag.error.rolloutSubjectInvalid` | Evaluation did not receive the subject required by the registry definition.                      |
| `targetInvalid`         |    `50608` |  400 | `featureFlag.error.targetInvalid`         | The target list contains duplicates, exceeds 100 entries, or does not match the rollout subject. |
| `targetNotFound`        |    `50609` |  404 | `featureFlag.error.targetNotFound`        | At least one requested user or workspace target does not exist.                                  |

Workspace override failures also belong to the feature-flag block because `FeatureFlagWorkspaceOverride` is a feature-flag-owned entity. The existing `configInvalid` member covers an unknown configuration key or a value that fails its schema.

| member                           | statusCode | HTTP | messagePath                                        | Description                                                                                       |
| -------------------------------- | ---------: | ---: | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `workspaceOverrideWindowInvalid` |    `50610` |  400 | `featureFlag.error.workspaceOverrideWindowInvalid` | The override validity window does not end after it starts.                                        |
| `workspaceOverrideConflict`      |    `50611` |  409 | `featureFlag.error.workspaceOverrideConflict`      | The requested dated override overlaps another dated override for the workspace and configuration. |
| `workspaceOverrideImmutable`     |    `50612` |  409 | `featureFlag.error.workspaceOverrideImmutable`     | The requested operation would change or delete an expired override.                               |
| `workspaceOverrideNotFound`      |    `50613` |  404 | `featureFlag.error.workspaceOverrideNotFound`      | The requested override does not exist in the addressed workspace, feature, and configuration.     |

There is no missing-workspace-feature-row error because workspace feature rows do not exist.

## Future Scopes

`FeatureFlagWorkspaceOverride` is the only override model in this design. It stores workspace-level values for both workspace and project feature definitions because project configuration currently applies to every project in the workspace.

The model carries no polymorphic `scopeType`, generic `scopeId`, nullable foreign keys for hypothetical entity types, or generic priority. A concrete requirement for different values between individual projects introduces `FeatureFlagProjectOverride` with a required `projectId` foreign key. Its resolver defines project-to-workspace-to-platform precedence, and the project-specific API and cache surface are added with that model.

Project rollout remains workspace-based until a concrete project-subject rollout requirement adds a registry subject and typed target relation. Adding another workspace-scoped feature requires only a registry fragment and seeded configuration definitions; existing workspaces inherit the platform values without an override backfill.

## Implementation Steps

Test-first, in this order:

1. Define the rollout-subject enum, `FeatureFlagWorkspace`, `FeatureFlagConfig`, `FeatureFlagWorkspaceOverride`, their relations, and the create, update, and delete workspace-override activity actions; `FeatureFlag` carries no `metadata`. Add the partial unique index for the undated override and the `btree_gist` exclusion constraint for dated windows through the customized migration. The owner applies the schema with `pnpm db:migrate`.
2. Add rootless `FeatureFlagWorkspaceRegistry` and `FeatureFlagProjectRegistry` definitions, assign their `workspace` and `project` keys while assembling the duplicate-key-safe `FeatureFlagRegistry`, and derive feature and configuration key types from the aggregate. Add rollout-subject validation, per-key Zod validation, and the boot integrity check.
3. Make the feature-flag seed materialize the catalog and configuration definitions, initialize new platform values from registry defaults, and preserve mutable operational values.
4. Add subject-aware rollout evaluation, typed target replacement, post-commit cache invalidation, structured decision reasons, and the platform target endpoint.
5. Add configuration and workspace-override repository methods, dated-then-undated resolution, separate global and workspace cache-key patterns, scoped workspace cache purging, and request-store reuse, including transaction-aware uncached resolution for limit enforcement.
6. Add feature-flag exceptions, status codes, and i18n messages for catalog, targeting, configuration, and workspace-override failures.
7. Add `@WorkspaceFeatureFlagProtected` and its guard, backed by the shared rollout and configuration resolver.
8. Enforce `workspace.configs.invitation` across every invitation route and domain flow, including list and revoke, and enforce `workspace.configs.joinRequest` across create, list, accept, and reject. Keep only expiry and workspace-deletion cleanup ungated.
9. Move project routes to `project`, workspace analytic routes to `workspace.configs.analytic`, and leave core workspace lifecycle on `workspace`.
10. Add and export `WorkspaceFeatureFlagDomain` for workspace validation, workspace-row locking, undated override writes, dated scheduling and history, transactional active replacement, overlap handling, and the three operation-discriminated workspace-override activity contracts.
11. Return rollout subjects, targets, configuration definitions, and platform values from the platform admin list; the feature-flag API exposes no metadata update surface.
12. Add feature-flag-owned workspace request and response DTOs, `FeatureFlagWorkspaceHttpService`, `FeatureFlagUserController`, and the workspace routes on `FeatureFlagAdminController`. Import `WorkspaceDomainModule` from `FeatureFlagHttpModule` and verify the application boots without a module cycle.
13. Apply `maxProjects` in the project creation transaction after locking the workspace row with PostgreSQL `FOR UPDATE`.
14. Update [Feature Flag][ref-doc-feature-flag], [Workspace][ref-doc-workspace], [Activity Log][ref-doc-activity-log], and [Status Codes][ref-doc-status-codes] after the runtime implementation lands.

<!-- REFERENCES -->

[ref-doc-feature-flag]: ../feature-flag.md
[ref-doc-workspace]: ../workspace.md
[ref-doc-database]: ../database.md
[ref-doc-activity-log]: ../activity-log.md
[ref-doc-status-codes]: ../status-codes.md
