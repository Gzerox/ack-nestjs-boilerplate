# CASL v7 Authorization Implementation Spec

## Scope

This specification defines a CASL v7 authorization model for the PostgreSQL and Prisma
application. It covers platform roles, workspace and project boundaries, stored rule evaluation,
object checks, field checks, and Prisma query filtering.

The implementation uses `@casl/ability` v7 and adds `@casl/prisma` when the Prisma query
adapter lands. Policy decisions remain in the policy domain and feature domains. Controllers
continue to delegate HTTP work, and repositories continue to own Prisma query shapes.

## Goals

- Store complete CASL rules with allow and deny semantics.
- Evaluate one request-scoped ability consistently in guards and domains.
- Preserve the workspace and project guards as resource-boundary checks.
- Support object-level checks and PostgreSQL/Prisma query filters.
- Validate persisted rules, fields, condition paths, and placeholders before storage.
- Give every permission-controlled operation an explicit subject/action pair.
- Keep role, policy, workspace, and project behavior covered by focused unit tests.

## Non-Goals

- Replace authentication, feature flags, term-policy gates, or workspace and project membership guards.
- Add a second authorization language beside CASL.
- Infer authorization from route names or HTTP verbs.
- Add unrestricted JSON conditions or arbitrary request placeholders.
- Change all feature repositories in the first implementation phase.
- Allow workspaces or projects to create, update, or delete their own roles.

## Existing Authorization Surface

Policies are persisted as rows related to a platform `Role`. A row currently stores one
`subject` and an array of `action` values. `RoleGuard` loads the caller's role policies into
request storage, and `PolicyGuard` creates a `MongoAbility` for static route checks.

`EnumPolicySubject` already includes `workspace` and `project`. Their admin read routes use
`@RoleProtected()` and `@PolicyProtected()`. User-scope workspace and project routes use the
workspace, project, and membership guard family to establish and protect the active workspace
and project.

This specification replaces the one-subject-per-row storage contract. It includes the Prisma
schema migration, client generation, seed update, and all affected role/policy DTOs. The schema
change is part of this work because full CASL rules cannot be represented by the existing table.

## Authorization Model

### Boundary Composition

Platform roles and workspace/project memberships describe different dimensions of authority.

- Admin-scope routes use `@PolicyProtected()`. A route narrowed to a workspace or project
  accepts a validated path id and does not read `x-workspace-id`.
- User and shared workspace routes keep `@WorkspaceProtected()` and the membership-resolving
  `@WorkspaceMemberProtected()` form as the workspace boundary. Project routes also keep
  `@ProjectProtected()` and `@ProjectMemberProtected()`.
- CASL adds capability, record, and field decisions after those guards establish the caller and
  workspace/project context. CASL does not turn a cross-workspace project into an accessible
  record.
- Workspace-owner project authority is expressed by the owner's workspace-role rules. It remains
  constrained to the active workspace and does not become a global project permission.

### Scoped Roles

`EnumWorkspaceMemberRole`, `EnumProjectMemberRole`, and `EnumRoleType` are removed. Permission
decisions come from CASL rules, so retaining any of these enums as a route or domain gate would
leave a second authorization system in place. Built-in roles use immutable keys such as
`superAdmin`, `admin`, `user`, `owner`, `member`, and `viewer`. `scope` and `key` identify a role;
the key does not grant permission by itself.

The existing `Role` model becomes the common policy parent for `platform`, `workspace`, and
`project` scopes. Sharing the model is appropriate because every role is the same concept: a
named, assignable collection of ordered CASL rules. Reusing the current platform-only shape
without an explicit scope is not appropriate. Workspace roles are assignable only to workspace
members, project roles are assignable only to project members, and platform roles are assignable
only to users. `Policy` continues to point to `Role`, so all scopes use the same rule validation,
ordering, and evaluation path.

The expected Prisma shape is:

```prisma
model Role {
  id          String        @id @default(dbgenerated("uuidv7()")) @db.Uuid
  scope       EnumRoleScope
  key         String
  name        String
  description String?

  policies         Policy[]           @relation("RolePolicy")
  users            User[]             @relation("UserRole")
  workspaceMembers WorkspaceMember[] @relation("WorkspaceMemberRole")
  projectMembers   ProjectMember[]    @relation("ProjectMemberRole")

  createdAt DateTime @default(now())
  createdBy String?  @db.Uuid
  updatedAt DateTime @updatedAt
  updatedBy String?  @db.Uuid

  @@unique(fields: [scope, key])
  @@index(fields: [scope, createdAt(sort: Desc)])
  @@map("roles")
}

enum EnumRoleScope {
  platform
  workspace
  project
}
```

The role catalog is fixed and seeded once:

- Platform: `superAdmin`, `admin`, `user`.
- Workspace: `owner`, `admin`, `member`.
- Project: `admin`, `member`, `viewer`.

`@@unique([scope, key])` permits the same readable key in different scopes while keeping each
seeded role unambiguous. Assignment domains validate the expected scope before writing
`User.roleId`, `WorkspaceMember.roleId`, or `ProjectMember.roleId`. Role keys and scopes are
immutable because domains use them for assignment validation and ownership invariants.

Only platform administrators can update role display metadata or policy rows. The first version
does not expose role creation or deletion, and workspace/project administrators have no role or
policy administration endpoints. A policy update changes that preset for every assignment using
the role. Workspace-owned custom roles remain a future schema and API extension.

`WorkspaceMember.role` changes to `roleId` with a relation to a workspace-scoped role.
`ProjectMember.role` changes to `roleId` with a relation to a project-scoped role. The role
resolver validates the expected workspace or project scope before the role enters request
storage.

`WorkspaceInvite.workspaceRole` and `WorkspaceInvite.projectRole` likewise become
`workspaceRoleId` and `projectRoleId`. Invite creation validates both role scopes before storing
the invitation, and invite claim repeats the validation inside the membership transaction.

The seeded workspace and project roles use the matrix in this document. Ownership transfer,
last-owner protection, peer management, and role-scope validation remain domain invariants.

### Actions

`manage` remains CASL's only wildcard action and `all` remains its wildcard subject. `manage` is
valid only with `all`, and `all` accepts no other action. The seeded `manage`/`all` super-admin
rule is not editable through the role-policy API.

Actions split into two catalogs rather than one flat enum:

- **Generic actions** — `EnumPolicyAction { manage, read, create, update, delete }`. Every
  subject that persists a resource uses these CRUD verbs for ordinary lifecycle operations.
  `manage` stays `all`-only, as above.
- **Per-subject workflow actions** — one small enum per subject that needs a domain verb beyond
  CRUD, named `Enum<Subject>Action`:
  - `EnumWorkspaceAction { transferOwnership }`
  - `EnumWorkspaceInviteAction { resend, revoke, claim }`
  - `EnumWorkspaceJoinRequestAction { accept, reject }`
  - `EnumProjectMemberAction { assign }`

  `workspaceMember` and `project` need no domain verb beyond CRUD and keep only the generic
  enum: removing a member is the generic `delete` action on `workspaceMember`, and removing a
  project member is the generic `delete` action on `projectMember`, replacing the previous
  `remove` verb.

A subject's full action catalog is the union of `EnumPolicyAction` (minus `manage`, which stays
`all`-only) and its own workflow enum, if it has one. The registry's `actions` field is typed as a
union over both:

```ts
type PolicySubjectAction<TWorkflow extends string = never> =
    | Exclude<EnumPolicyAction, 'manage'>
    | TWorkflow;
```

This mirrors the codebase's existing precedent for subject-scoped enums living in the schema
(`EnumWorkspaceInviteStatus`, `EnumWorkspaceJoinRequestStatus`), extended to actions. Because a
single PostgreSQL/Prisma column cannot span multiple enum types, the persisted `action` column
moves from a typed Prisma enum array to a validated `String[]` — the domain layer checks each
stored string against the subject's registry entry (`EnumPolicyAction` members plus that
subject's workflow enum members) the same way `fields` and `conditions` are already validated
outside the database (see the Stored Rule Contract section below).

The workspace/project action catalog is:

| Subject                | Generic actions                      | Workflow actions (`Enum<Subject>Action`)                 |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------- |
| `workspace`            | `read`, `create`, `update`, `delete`   | `EnumWorkspaceAction`: `transferOwnership`                  |
| `workspaceMember`      | `read`, `update`, `delete`             | none                                                         |
| `workspaceInvite`      | `read`, `create`                       | `EnumWorkspaceInviteAction`: `resend`, `revoke`, `claim`    |
| `workspaceJoinRequest` | `read`, `create`                       | `EnumWorkspaceJoinRequestAction`: `accept`, `reject`        |
| `project`              | `read`, `create`, `update`, `delete`   | none                                                        |
| `projectMember`        | `read`, `update`, `delete`             | `EnumProjectMemberAction`: `assign`                         |

The same naming rule applies to platform resources: CRUD verbs are reused where the subject makes
their meaning complete; a workflow enum is added only for a subject with a domain verb beyond
CRUD, such as assigning a role, revoking a session, rotating an API key, or publishing a term
policy. Every enum contains only actions backed by an endpoint or domain operation.

`update` on `workspace` covers name, description, visibility, and slug changes. `update` on
`project` covers name, description, and slug changes. These operations receive separate actions
only when the product needs different grants.

Workspace switching requires no CASL permission. It succeeds when the caller belongs to the
target workspace and fails otherwise. Leaving a workspace or project is also a self-service
membership operation with no CASL permission. Listing workspaces also requires no CASL
permission — see the `workspace:list` exception in "Scoping Placeholder Conventions" below. The
domains still enforce identity, membership, last-owner, and related business invariants.

### Subjects

The policy subject enum contains these workspace/project resources:

```text
workspace
workspaceMember
workspaceInvite
workspaceJoinRequest
project
projectMember
```

Each subject maps to one persisted resource with its own fields, conditions, and Prisma query
shape. Subjects use camelCase model-aligned names rather than colon-delimited values. For example,
`workspaceInvite` maps directly to `WorkspaceInvite`; `workspace:invite` would require an
additional enum-to-model translation without changing the permission boundary.

`PolicySubjectRegistry` maps every enum value to its Prisma model name, permitted fields,
condition paths, mandatory scope placeholder, and subject-instance adapter. Enum values remain
camelCase; Prisma model names remain PascalCase. This avoids using an enum string as a model
constructor or a Prisma delegate.

Every subject definition also carries a `scopePlaceholder`, naming the placeholder condition its
stored rules must include (see
[Scoping Placeholder Conventions](#scoping-placeholder-conventions) below for the normative rule
and its two exceptions, `workspace:create` and `workspaceJoinRequest:create`):

```ts
type IPolicySubjectDefinition<TWorkflowAction extends string = never> = {
    modelName: Prisma.ModelName;
    actions: readonly (Exclude<EnumPolicyAction, 'manage'> | TWorkflowAction)[];
    fields: readonly string[];
    conditionPaths: readonly string[];
    scopePlaceholder: '${workspace.id}' | '${project.id}' | null;
};

const PolicySubjectRegistry = {
    workspace: {
        modelName: 'Workspace',
        actions: [
            EnumPolicyAction.read,
            EnumPolicyAction.create,
            EnumPolicyAction.update,
            EnumPolicyAction.delete,
            EnumWorkspaceAction.transferOwnership,
        ],
        fields: ['name', 'slug', 'description', 'isPublic'],
        conditionPaths: ['id', 'createdBy', 'isPublic', 'deletedAt'],
        // Mandatory `${workspace.id}` -> `workspaceId` condition, except `create`: no
        // workspace exists yet for the row being created (see §5 exception).
        scopePlaceholder: '${workspace.id}',
    },
    workspaceMember: {
        modelName: 'WorkspaceMember',
        actions: [
            EnumPolicyAction.read,
            EnumPolicyAction.update,
            EnumPolicyAction.delete,
        ],
        fields: ['roleId'],
        conditionPaths: ['id', 'workspaceId', 'userId', 'roleId', 'role.key'],
        scopePlaceholder: '${workspace.id}',
    },
    workspaceInvite: {
        modelName: 'WorkspaceInvite',
        actions: [
            EnumPolicyAction.read,
            EnumPolicyAction.create,
            EnumWorkspaceInviteAction.resend,
            EnumWorkspaceInviteAction.revoke,
            EnumWorkspaceInviteAction.claim,
        ],
        fields: [
            'email',
            'workspaceRoleId',
            'projectId',
            'projectRoleId',
            'expiredAt',
            'status',
        ],
        conditionPaths: [
            'id',
            'workspaceId',
            'projectId',
            'status',
            'invitedByUserId',
            'acceptedByUserId',
        ],
        scopePlaceholder: '${workspace.id}',
    },
    workspaceJoinRequest: {
        modelName: 'WorkspaceJoinRequest',
        actions: [
            EnumPolicyAction.read,
            EnumPolicyAction.create,
            EnumWorkspaceJoinRequestAction.accept,
            EnumWorkspaceJoinRequestAction.reject,
        ],
        fields: ['message', 'status', 'rejectReasonCode'],
        conditionPaths: [
            'id',
            'workspaceId',
            'userId',
            'status',
            'reviewedByUserId',
        ],
        // Mandatory `${workspace.id}` -> `workspaceId` condition, except `create`: the caller
        // is not yet a member of the target workspace (see §5 exception).
        scopePlaceholder: '${workspace.id}',
    },
    project: {
        modelName: 'Project',
        actions: [
            EnumPolicyAction.read,
            EnumPolicyAction.create,
            EnumPolicyAction.update,
            EnumPolicyAction.delete,
        ],
        fields: ['name', 'slug', 'description'],
        conditionPaths: ['id', 'workspaceId', 'createdBy', 'deletedAt'],
        // Mandatory `${project.id}` -> `projectId` condition, in addition to the workspace
        // scope a project inherits transitively through `workspaceId`.
        scopePlaceholder: '${project.id}',
    },
    projectMember: {
        modelName: 'ProjectMember',
        actions: [
            EnumPolicyAction.read,
            EnumProjectMemberAction.assign,
            EnumPolicyAction.update,
            EnumPolicyAction.delete,
        ],
        fields: ['roleId'],
        conditionPaths: ['id', 'projectId', 'userId', 'roleId', 'role.key'],
        // Mandatory `${project.id}` -> `projectId` condition. `assign` is the exception noted
        // in §5: the permission itself is the only gate for "can assign any member in the
        // project", so an `assign` rule carries the `projectId` scope but no member-instance
        // (`id`) condition.
        scopePlaceholder: '${project.id}',
    },
} as const satisfies Record<string, IPolicySubjectDefinition>;
```

The registry includes definitions for every existing platform subject before rule validation is
enabled for that subject. Rule validation rejects an action that is not registered for its
subject — checked against the union of `EnumPolicyAction` and that subject's workflow enum, not
against a single flat action enum. Relation paths use Prisma relation syntax and are listed
explicitly.

`workspace:list` carries no registry entry at all: every authenticated user can list workspaces,
so the operation has no subject and no action. Visibility and membership still filter the result
set, but that is a query concern the repository applies directly, not a policy decision. See
[Scoping Placeholder Conventions](#scoping-placeholder-conventions) below.

### Scoping Placeholder Conventions

Every workspace-scoped and project-scoped subject rule carries the placeholder condition that
ties it to the active boundary. This was implied by the placeholder allow-list and the "Default
Scoped Role Rules" prose; it is a normative rule:

- Every **workspace-scoped** subject (`workspace`, `workspaceMember`, `workspaceInvite`,
  `workspaceJoinRequest`) rule's stored condition MUST include a `workspaceId` key resolved from
  the `${workspace.id}` placeholder, populated from the request's `x-workspace-id` header.
- Every **project-scoped** subject (`project`, `projectMember`) rule's stored condition MUST
  include a `projectId` key resolved from the `${project.id}` placeholder, populated from the
  request's `:projectId` route param. This is in addition to the workspace scope a project rule
  already carries transitively, because a project belongs to a workspace.
- Rule validation rejects a workspace- or project-scoped subject's condition that omits its
  mandatory key, **except** the following documented exceptions:
  - `workspace:create` — no workspace exists yet for the row being created.
  - `workspaceJoinRequest:create` — the caller is not yet a member of the target workspace.
  - `projectMember:assign` — the permission itself is the only gate: holding it means "can
    assign any member in the project." The rule still carries the `projectId` scope; it just
    carries no member-instance (`id`) condition.
- `workspace:list` needs no entry in this rule at all: it carries no subject and no action (see
  above), so it has no condition to validate. Listing is a query concern — visibility and
  membership filter the result set directly — not a policy decision.

The placeholder allow-list `PolicyConditionPlaceholderUtil` resolves is:

- `${user.id}`
- `${user.roleId}`
- `${user.role.key}`
- `${workspace.id}`
- `${workspaceMember.id}`
- `${workspaceMember.roleId}`
- `${workspaceMember.role.key}`
- `${project.id}`
- `${projectMember.id}`
- `${projectMember.roleId}`
- `${projectMember.role.key}`
- `${request.language}`

## Stored Rule Contract

One policy row represents one ordered CASL rule. A rule has one subject and one or more
actions. A subject array is expanded into multiple rule rows by the policy domain before
persistence; it is not stored in a scalar database column. This keeps queries, indexes, and
rule ordering unambiguous.

```ts
interface IPolicyRuleStorage {
    subject: EnumPolicySubject;
    action: string[];
    fields: string[];
    conditions: Prisma.JsonValue | null;
    inverted: boolean;
    reason: string | null;
    priority: number;
}
```

`action` is `string[]`, not a typed Prisma enum array. Splitting actions into a generic enum plus
one workflow enum per subject (see [Actions](#actions)) means no single Postgres/Prisma enum
type can describe every subject's action column. The policy domain validates each stored string
against the subject's registry entry — `EnumPolicyAction` members plus that subject's workflow
enum members, if any — before persistence, the same way it already validates `fields` and
`conditions` outside the database.

The Prisma `Policy` model's `action` column changes from a typed enum array to `action String[]`.
It also gains `fields String[] @default([])`, `conditions Json?`, `inverted Boolean
@default(false)`, `reason String?`, and `priority Int`. An empty `fields` list maps to an
unrestricted CASL rule; a non-empty list maps to field-restricted access. The unique constraint
on `(roleId, subject)` is replaced with `@@unique([roleId, priority])` and an index on
`[roleId, subject, priority]`.

CASL evaluates rules in order. The policy repository reads rules by `priority` ascending, and
the policy domain assigns a stable priority when creating, moving, or replacing a rule. A role
can therefore have an allow rule and a later deny rule for the same subject.

Ability composition is deterministic: platform rules are added first, workspace rules second,
and project rules third; each source is ordered by ascending `priority`. CASL gives the later
matching rule precedence, so a project rule can narrow a workspace rule and a workspace rule can
narrow a platform rule. An absent narrower rule does not revoke a broader allow; a narrowing role
uses an explicit inverted rule.

The role-policy API exposes a rule request DTO with one subject, action array, optional fields,
optional conditions, optional inverted flag, optional reason, and an explicit priority. A bulk
replace endpoint may accept an array of that DTO to make ordering transactional. The existing
single-row endpoints retain the same semantics through the new DTO.

## PostgreSQL and Prisma Conditions

Persisted conditions use the Prisma `WhereInput` dialect for the registry model. They do not use
Mongo operators or dotted paths. For example, an ownership rule is stored as:

```json
{
    "userId": "${user.id}"
}
```

A relation condition is represented with Prisma operators:

```json
{
    "role": {
        "is": {
            "scope": "platform",
            "key": { "not": "superAdmin" }
        }
    }
}
```

`PolicyConditionPlaceholderUtil` traverses an object or array and replaces only complete string
values from the placeholder allow-list in
[Scoping Placeholder Conventions](#scoping-placeholder-conventions) above, which also states the
`workspaceId`/`projectId` mandatory-key rule that governs which of those placeholders a given
subject's rules must use.

The validator rejects unknown placeholders, partial interpolation, prototype-pollution keys,
unlisted fields, unlisted relation paths, unsupported Prisma operators, and values incompatible
with the target field. Conditions are JSON data, not executable expressions.

The adapter builds `PrismaAbility` with `createPrismaAbility`. It uses the registry's model name
when deriving `accessibleBy(ability, action)[modelName]`. Repository queries compose that result
with business predicates through `AND`, including active-row and workspace/project predicates.
They never spread an authorization filter into another `where` object.

Object checks use `subject(registry[subject].modelName, record)` with a loaded, typed record.
They do not rely on `constructor` detection for Prisma plain objects.

## Ability Lifecycle

`PolicyDomain` owns ability construction and evaluation. It provides:

```ts
buildForRequest(context: IPolicyRequestContext): IPolicyAbility;
getCurrentAbility(): IPolicyAbility;
can(action: PolicySubjectAction, subject: IPolicySubjectInput): boolean;
assertCan(action: PolicySubjectAction, subject: IPolicySubjectInput): void;
toWhere(action: PolicySubjectAction, subject: EnumPolicySubject): Prisma.JsonObject;
permittedFields(action: PolicySubjectAction, subject: IPolicySubjectInput): string[];
```

`PolicySubjectAction` is the non-generic collapse of the `PolicySubjectAction<TWorkflow>` union
from [Actions](#actions) — `Exclude<EnumPolicyAction, 'manage'> | string` — because a single
domain-level API surface spans every subject and cannot be parameterized per call. `PolicyDomain`
validates the action against the resolved subject's registry entry before evaluating the
ability, which recovers the subject-specific union at the validation boundary.

The policy domain creates an ability once, stores it under a dedicated request-store key, and
reuses it for route checks and downstream domain calls. The context is read from the resolved
user, workspace, workspace membership, project, and project membership entries. A missing entry
is an error only when the route's guard stack requires it.

`PolicyGuard` reads static route metadata and calls `PolicyDomain.assertCan`. `PolicyDomain`
loads the platform role from the user and the workspace/project roles from the resolved
memberships. A workspace route can therefore use CASL without a platform-role guard solely to
populate policy storage.

`@RoleProtected()`, `RoleGuard`, and the super-admin bypass are removed after their routes carry
equivalent policy metadata. The super-admin role receives a persisted `manage`/`all` rule and
proceeds through the same ability construction and CASL evaluation as every other role. This
keeps permission data as the single source of authorization decisions.

## Object and Field Enforcement

Feature domains perform object decisions after loading the target record through their
repository. A route guard can check a resource already resolved by `WorkspaceGuard` or
`ProjectGuard`; it does not gain an unrestricted record-loading service.

Every permission-controlled feature-domain entry point asserts its subject/action pair before the
primary write. Route metadata provides the early static rejection, but it does not replace the
domain check. Writes that are consequences of one authorized operation, such as creating
memberships while claiming an invite, remain inside that operation's transaction and do not
invent separate permissions for internal steps.

An update or delete with conditions uses the authorization `where` in the mutation predicate
where the repository API can express it. This makes authorization and mutation one database
operation. A missing affected row follows the endpoint's established not-found or forbidden
contract without revealing an inaccessible row.

Field checks evaluate the actual subject instance when conditional field rules exist. The domain
loads the pre-update record, obtains permitted fields for that record, rejects disallowed request
keys, and passes only allowed fields to the repository. Response serialization applies the same
field policy when a response contains subject data.

## Workspace and Project Policy Matrix

The following CASL decisions are added incrementally after the existing workspace and project
guards succeed.

| Operation group                                | Subject                | Actions                                                                      | Existing boundary context                                | Notes                                              |
| ------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------- |
| Workspace list                                 | `none`                 | `none`                                                                        | authenticated user                                       | No CASL metadata; no `workspaceId` condition. Result set filtered by membership/visibility as a query concern (§5). |
| Workspace get                                  | `workspace`            | `read`                                                                        | workspace member where required                          | `workspaceId` condition per §5.                    |
| Workspace create/update/visibility/slug/delete | `workspace`            | `create`, `update`, `delete`                                                  | authenticated user or current workspace member           | `create` is the §5 exception: no `workspaceId` condition. |
| Ownership transfer                             | `workspace`            | `EnumWorkspaceAction.transferOwnership`                                       | current workspace membership                              | `workspaceId` condition per §5.                    |
| Workspace switch                               | none                   | none                                                                          | membership in the selected workspace                      |                                                     |
| Member list/role/remove                        | `workspaceMember`      | `read`, `update`, `delete`                                                    | current workspace and member                               | `workspaceId` condition per §5.                    |
| Workspace leave                                | none                   | none                                                                          | caller's current workspace membership                     |                                                     |
| Invite list/create                             | `workspaceInvite`      | `read`, `create`                                                              | current member or token-verified invite claimant           | `workspaceId` condition per §5.                    |
| Invite resend/revoke/claim                     | `workspaceInvite`      | `EnumWorkspaceInviteAction.resend`, `.revoke`, `.claim`                       | current member or token-verified invite claimant           | `workspaceId` condition per §5.                    |
| Join request create/list                       | `workspaceJoinRequest` | `create`, `read`                                                              | public workspace requester or current workspace member     | `create` is the §5 exception: no `workspaceId` condition. |
| Join request accept/reject                     | `workspaceJoinRequest` | `EnumWorkspaceJoinRequestAction.accept`, `.reject`                           | current workspace member                                    | `workspaceId` condition per §5.                    |
| Project list/get/create/update/slug/delete     | `project`              | `read`, `create`, `update`, `delete`                                          | current workspace and project visibility/member context    | `workspaceId` and `projectId` conditions per §5.   |
| Project member list/role/remove                | `projectMember`        | `read`, `update`, `delete`                                                    | current workspace, project, and project membership          | `projectId` condition per §5.                      |
| Project member assign                          | `projectMember`        | `EnumProjectMemberAction.assign`                                              | current workspace, project, and project membership          | `projectId` condition, no member-instance condition (§5 exception). |
| Project leave                                  | none                   | none                                                                          | caller's current project membership                        |                                                     |

## Default Scoped Role Rules

Workspace and project capabilities are persisted rules on workspace- and project-scoped roles.
`PolicyDomain.buildForRequest` combines platform-role policies with the workspace and project
roles resolved from the request memberships.

Each scoped rule is constrained to the active workspace or project per the
[Scoping Placeholder Conventions](#scoping-placeholder-conventions) above: workspace rules carry
a `workspaceId` condition resolved from `${workspace.id}`, and project rules carry a `projectId`
condition resolved from `${project.id}` in addition to the workspace scope they inherit
transitively. A scoped role therefore does not grant access to another workspace or project when
its actions are reused downstream. Every capability listed below implicitly carries its
subject's mandatory placeholder condition from §5 unless the row says otherwise.

| Role     | Scope     | Capabilities                                                                                                                                                                                                                                                                                       |
| -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner`  | workspace | `workspace`: `read`, `update`, `delete`, `EnumWorkspaceAction.transferOwnership`; `workspaceMember`: `read`, `update`, `delete`; `workspaceInvite`: `read`, `create`, `EnumWorkspaceInviteAction.resend`/`.revoke`; `workspaceJoinRequest`: `read`, `EnumWorkspaceJoinRequestAction.accept`/`.reject`; every `project` and `projectMember` action |
| `admin`  | workspace | `workspace`: `read`, `update`; `workspaceMember`: `read`, `update`, `delete`; `workspaceInvite`: `read`, `create`, `EnumWorkspaceInviteAction.resend`/`.revoke`; `workspaceJoinRequest`: `read`, `EnumWorkspaceJoinRequestAction.accept`/`.reject`; `project`: `create`, `delete`                     |
| `member` | workspace | `workspace`: `read`; `workspaceMember`: `read`                                                                                                                                                                                                                                                        |
| `admin`  | project   | `project`: `read`, `update`; `projectMember`: `read`, `EnumProjectMemberAction.assign` (no member-instance condition, §5 exception), `update`, `delete`                                                                                                                                               |
| `member` | project   | `project`: `read`; `projectMember`: `read`                                                                                                                                                                                                                                                            |
| `viewer` | project   | `project`: `read`; `projectMember`: `read`                                                                                                                                                                                                                                                            |

The workspace `admin` role has the project actions granted directly by the current route guards.
It does not receive project read or update authority through its workspace role; those actions
require a project membership. The workspace `owner` role retains project authority through its
workspace-scoped CASL rules.

Role administration uses the existing `role` subject. Platform administrators can read the
complete preset catalog and update role display metadata and ordered policy rows. Role creation,
deletion, key changes, and scope changes are not exposed. Workspace owners, workspace admins,
and project admins cannot administer roles or policies.

Policy updates validate the subject/action catalog for the role's scope. Workspace roles cannot
receive platform actions, and project roles cannot receive platform or workspace actions. The
workspace `owner` role remains the only role recognized by ownership-transfer and last-owner
domain invariants.

Workspace creation and join-request creation happen before a workspace membership exists. The
base authenticated-user role grants `read` and `create` on `workspace`, `claim` on
`workspaceInvite`, and `create` on `workspaceJoinRequest`, with the matching conditions.
The join-request domain still verifies that the target workspace is public and that the caller
is not already a member. Invite claim remains token-verified and has no workspace-role rule; the
authenticated-user rule and invite token are both required.

Workspace switching and workspace/project leave are membership-derived operations. The switch
domain validates membership for the selected workspace; leave routes resolve the current caller's
membership row and remove that row. These operations do not consult CASL.

The existing domain rules remain in force after a scoped role grants the action: an owner cannot
be removed through a peer operation, the last owner cannot leave, and role-transition validation
continues to protect membership invariants.

## Initial Seed Rules

The initial policy seed is explicit rather than derived from every enum member.

- `superAdmin`: `manage` on `all`.
- `admin`: platform-management rules plus `read` on `workspace`, `workspaceMember`, and `project`
  for existing admin-scope endpoints. Additional actions, generic or per-subject workflow
  (`EnumWorkspaceAction`, `EnumWorkspaceInviteAction`, `EnumWorkspaceJoinRequestAction`,
  `EnumProjectMemberAction`), are added only with matching admin endpoints.
- `user`: grants `read` and `create` on `workspace`, `EnumWorkspaceInviteAction.claim` on
  `workspaceInvite`, and `create` on `workspaceJoinRequest`. The `workspace:create` and
  `workspaceJoinRequest:create` rules are the two documented exceptions in
  [Scoping Placeholder Conventions](#scoping-placeholder-conventions) — no `workspaceId`
  condition, since no workspace exists yet or the caller is not yet a member. The `claim` rule on
  `workspaceInvite` still carries its `workspaceId` condition.
- Workspace roles: seed `owner`, `admin`, and `member` once with the workspace rows in the scoped
  role matrix, using `EnumWorkspaceAction`/`EnumWorkspaceInviteAction`/
  `EnumWorkspaceJoinRequestAction` for the workflow verbs.
- Project roles: seed `admin`, `member`, and `viewer` once with the project rows in the scoped
  role matrix, using `EnumProjectMemberAction` for `assign` (§5 exception: `projectId` condition
  only, no member-instance condition).

The seed upsert key changes from `(roleId, subject)` to `(roleId, priority)`. Seed updates
replace managed rules deterministically and preserve priorities.

## Delivery Plan

### Phase 1: Characterize Existing Behavior

- Cover current policy factory, policy guard, policy domain, and role guard behavior.
- Cover super-admin bypass, missing user, missing metadata, denied static action, and policy
  storage by `RoleGuard`.
- Cover workspace/project guard ordering, cross-workspace project rejection, workspace-owner
  project bypass, and user-scope visibility behavior.

### Phase 2: Scoped Role Migration

- Add role scope and immutable role keys to the authorization schema.
- Replace `WorkspaceMember.role`, `ProjectMember.role`, and the role fields on `WorkspaceInvite`
  with scoped role relations. Migrate existing owner/admin/member/viewer values to default roles.
- Seed the fixed workspace and project roles once, then backfill membership and invitation
  references to those roles.
- Replace role-gated workspace/project decorators and guards with membership resolution plus
  CASL action checks.
- Keep role and policy administration platform-only. Expose no workspace/project role creation,
  update, or deletion endpoints.
- Preserve owner, peer-management, and role-scope constraints in their domains and repositories.

### Phase 3: Schema, DTO, and Seed Migration

- Add rule columns, priority constraint/indexes, the generic `EnumPolicyAction`, the per-subject
  workflow enums (`EnumWorkspaceAction`, `EnumWorkspaceInviteAction`,
  `EnumWorkspaceJoinRequestAction`, `EnumProjectMemberAction`), and generated client updates.
- Change the `Policy.action` column from a typed enum array to `String[]`, validated at the
  domain layer against the subject's registry entry.
- Replace the one-subject-per-row DTO and response shape with the rule DTO.
- Update repository reads, writes, policy routes, seed data, and schema migration.
- Migrate existing rows to deterministic priorities and seed the super-admin `manage/all` rule.

### Phase 4: Typed Prisma Ability

- Add the subject registry, condition validator, placeholder resolver, and typed Prisma ability.
- Build normal and inverted rules in priority order.
- Store and reuse one request-scoped ability.
- Keep static `@PolicyProtected()` checks working through `PolicyGuard`.

### Phase 5: Object Checks

- Add domain-level `assertCan` checks for one platform resource and one workspace/project
  resource already resolved by the workspace/project guards.
- Use subject instances for in-memory decisions and constrained repository mutations for writes.

### Phase 6: Prisma Query Filtering

- Add `@casl/prisma` and the policy query adapter.
- Introduce `AND`-composed authorization filters in a representative list and detail flow.
- Add repository integration coverage outside the unit suite for generated Prisma conditions.

### Phase 7: Field Filtering and Explicit Actions

- Enforce conditional write fields and response fields for a representative subject.
- Normalize actions to the generic `EnumPolicyAction` plus each subject's workflow enum, then add
  policy metadata to every permission-controlled endpoint, including the mandatory
  `workspaceId`/`projectId` scope placeholder per subject and its documented exceptions.
- Update role-policy API examples and durable authorization documentation with the shipped
  behavior.

## Test Matrix

- Rule DTO validation: enum values, priority, fields, Prisma operators, relation paths,
  placeholders, action/subject compatibility, per-subject action-union membership (generic
  `EnumPolicyAction` plus the subject's workflow enum, if any), mandatory scope-placeholder
  presence per subject (with the `workspace:create`, `workspaceJoinRequest:create`, and
  `projectMember:assign` exceptions), and unsafe object keys.
- Ability factory: allow, deny, ordered precedence, condition resolution, `manage/all`, and
  immutable CASL rule arrays.
- Policy domain: request-scoped reuse, `can`, `assertCan`, object subjects, field decisions,
  and Prisma `where` generation.
- Guards: static metadata, missing context, platform policy behavior, workspace/project stacking,
  scoped-role resolution, and no admin dependency on a workspace header.
- Workspace/project domains: workspace and project boundaries remain active before capability checks;
  unauthorized mutations use constrained database predicates; owner and peer-management
  invariants survive role-policy changes.
- Permission inventory: every permission-controlled operation maps to one subject/action pair;
  workspace switch and workspace/project leave remain membership-only operations.
- Seed data: platform, workspace, and project role sets map to valid actions, subjects, scopes,
  and priorities.

Run unit checks with `pnpm test policy`, `pnpm test role`, `pnpm test workspace`, and
`pnpm test project`. Run `pnpm typecheck`, `pnpm lint`, and `pnpm spell` after each completed
implementation phase. Query-adapter integration coverage runs against PostgreSQL in its dedicated
test environment.

## Acceptance Checklist

- `Role` carries only an explicit platform/workspace/project scope, immutable key, display
  metadata, policies, and assignments. It has no `EnumRoleType`, `isSystem`, `isOwner`,
  `workspaceId`, or `projectId` field.
- The fixed role catalog is seeded once, with unique keys inside each scope.
- PostgreSQL schema stores ordered CASL rules and permits multiple rules for one role/subject.
- Conditions use validated Prisma `WhereInput` semantics.
- The subject registry separately covers workspace, workspace member, workspace invite, workspace
  join request, project, and project member resources before they accept persisted rules.
- Lifecycle permissions use the generic `EnumPolicyAction` (`read`, `create`, `update`,
  `delete`); workflow permissions use a per-subject `Enum<Subject>Action` (a concise domain
  verb). The registry rejects invalid action/subject pairs, and the persisted `action` column is
  `String[]` validated at the domain layer, not a single typed Prisma enum array.
- The ability is request-scoped and the super-admin role evaluates through CASL.
- `@RoleProtected()`, `RoleGuard`, and the super-admin bypass are removed after equivalent CASL
  metadata covers their routes.
- Workspace members, project members, and invitations reference scoped roles; the role enums and
  their hard-coded permission guards are removed.
- Only platform administrators can update preset roles and policies. Workspace/project role
  administration and custom roles are outside the first version.
- Workspace and project guards remain resource boundaries.
- Every permission-controlled operation has explicit CASL policy metadata and a domain assertion.
- Workspace switch and workspace/project leave use membership and domain invariants without a
  CASL permission.
- Object, field, and query enforcement are introduced only with their matching domain and
  repository behavior.
- Seeds, DTOs, OpenAPI responses, activity contracts, and tests move with every new action or
  subject.
- Workspace-scoped and project-scoped subject rules carry their mandatory `workspaceId`/
  `projectId` condition, except the documented `create`-before-membership and
  `projectMember:assign` exceptions.
- `workspace:list` requires no policy metadata: no subject, no action, no condition.
