# CASL v7 Authorization Implementation Spec

## Scope

This specification defines a CASL v7 authorization model for the PostgreSQL and Prisma
application. It covers platform roles, workspace and project boundaries, stored rule evaluation,
object checks, and Prisma query filtering.

The implementation uses `@casl/ability` v7 and adds `@casl/prisma` when the Prisma query
adapter lands. Policy decisions remain in the policy domain and feature domains. Controllers
continue to delegate HTTP work, and repositories continue to own Prisma query shapes.

## Goals

- Store complete CASL rules with allow and deny semantics.
- Evaluate one request-scoped ability consistently in guards and domains.
- Preserve the workspace and project guards as resource-boundary checks.
- Support object-level checks and PostgreSQL/Prisma query filters.
- Validate persisted rules, conditions, and placeholders before storage.
- Give every permission-controlled operation an explicit subject/action pair.
- Keep role, policy, workspace, and project behavior covered by focused unit tests.

## Non-Goals

- Replace authentication, feature flags, term-policy gates, or workspace and project membership guards.
- Add a second authorization language beside CASL.
- Infer authorization from route names or HTTP verbs.
- Add unrestricted JSON conditions or arbitrary request placeholders.
- Change all feature repositories in the first implementation phase.
- Restrict rules to individual fields. Field-level permissions can extend the rule contract later.
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
- CASL adds capability and record decisions after those guards establish the caller and
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

`manage` remains CASL's only wildcard action and `all` remains its wildcard subject. `manage`
with `all` is the super-admin rule; it is not editable through the role-policy API and `all`
accepts no other action. `manage` on a subject means every action on that subject and is valid
on any persisted subject.

The table below is descriptive: it lists the actions the routes in this spec use per subject. It
is not an enforced catalog, and any (subject, action) pair may be stored.

Every subject uses one action vocabulary, `EnumPolicyAction { manage, read, create, update,
delete }`, stored in the `Policy.action` column as a typed Prisma enum array. There are no
per-subject workflow enums: a domain operation maps to a CRUD verb, or to `manage` when it is a
privileged action that must not be granted on its own.

| Subject                | Actions                              | Operations covered                                                             |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| `workspace`            | `read`, `update`, `delete`, `manage` | `manage` covers ownership transfer and implies `read`/`update`/`delete`         |
| `workspaceMember`      | `update`, `delete`                   | role change, member removal                                                    |
| `workspaceInvite`      | `create`, `manage`                   | `manage` covers create, resend, and revoke                                     |
| `workspaceJoinRequest` | `update`                             | accept and reject (a status transition; cannot be granted separately)          |
| `project`              | `read`, `create`, `update`, `delete` | project lifecycle                                                              |
| `projectMember`        | `create`, `update`, `delete`         | `create` assigns a member; role change; removal                                |

Granting `manage` on `workspaceInvite` therefore grants resend and revoke together with create,
and granting it on `workspace` grants ownership transfer. Only the workspace `owner` role holds
`workspace:manage`; the domain still restricts transfer to the owner.

`update` on `workspace` covers name, description, visibility, and slug changes. `update` on
`project` covers name, description, and slug changes. These operations receive separate actions
only when the product needs different grants.

The following operations require no CASL permission and have no subject or action:

- Workspace `list`, `create`, `leave`, and `switch`. Every authenticated user may perform them,
  and each only ever touches workspaces the caller has access to. Switching succeeds when the
  caller belongs to the target workspace and fails otherwise. Leaving a workspace or project is a
  self-service membership operation.
- Workspace member `list`, workspace invite `list`, and workspace join-request `list`. Membership
  in the workspace is the gate, so any member may list them.
- Project `list` and project member `list`. Membership in the workspace (project list) or the
  project (member list) is the gate, so any such member may list. The project list result set is
  filtered by visibility as a query concern.
- Project member `leave`. Every project member may leave; the domain enforces last-admin style
  invariants.
- Workspace invite `claim`. The invite token and the authenticated caller are both required.
- Workspace join-request `create`. The domain verifies that the target workspace is public and
  that the caller is not already a member.

The domains still enforce identity, membership, last-owner, and related business invariants.

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

Each subject maps to one persisted resource with its own conditions and Prisma query
shape. Subjects use camelCase model-aligned names rather than colon-delimited values. For example,
`workspaceInvite` maps directly to `WorkspaceInvite`; `workspace:invite` would require an
additional enum-to-model translation without changing the permission boundary.

Everything the policy layer needs about a subject is derived, except its tenant scope:

- **Model name.** The subject with its first letter upper-cased (`workspaceInvite` becomes
  `WorkspaceInvite`), checked against `Prisma.ModelName`. This avoids using an enum string as a
  model constructor or a Prisma delegate.
- **Condition paths.** Validated against the target model's Prisma metadata: scalar columns plus
  the explicit relation path `role.key`.
- **Actions.** Any `EnumPolicyAction` may be stored for any subject. An action that no route
  checks for a subject never matches anything, and only platform administrators write policies.
- **Tenant scope.** The one part that lives in code, as `PolicySubjectScope`:

```ts
type IPolicyScope = {
    level: 'workspace' | 'project';
    key: string;
    placeholder: '${workspace.id}' | '${project.id}';
};

const PolicySubjectScope = {
    workspace: { level: 'workspace', key: 'id', placeholder: '${workspace.id}' },
    workspaceMember: { level: 'workspace', key: 'workspaceId', placeholder: '${workspace.id}' },
    workspaceInvite: { level: 'workspace', key: 'workspaceId', placeholder: '${workspace.id}' },
    workspaceJoinRequest: { level: 'workspace', key: 'workspaceId', placeholder: '${workspace.id}' },
    project: { level: 'project', key: 'id', placeholder: '${project.id}' },
    projectMember: { level: 'project', key: 'projectId', placeholder: '${project.id}' },
} as const satisfies Partial<Record<EnumPolicySubject, IPolicyScope>>;
```

A subject absent from the map is platform-level and carries no mandatory scope. `level` drives
role-scope validation: platform roles may hold any subject and are exempt from the mandatory scope
pair (the platform `admin` holds `read` on `workspace` and `project` without a scope condition),
workspace roles hold platform-level, workspace-level, and project-level subjects (the workspace
`owner` holds project rules), and project roles hold project-level subjects only. The mandatory
scope pair applies only to workspace and project roles. See
[Scoping Placeholder Conventions](#scoping-placeholder-conventions) for the normative rule.

The operations listed under [Actions](#actions) as requiring no CASL permission (workspace
`list`/`create`/`leave`/`switch`, member/invite/join-request `list`, invite `claim`, and
join-request `create`) carry no subject and no action. Visibility and membership still filter
their result sets, but that is a query concern the repository applies directly, not a policy
decision.

### Scoping Placeholder Conventions

Every workspace-scoped and project-scoped subject rule carries the placeholder condition that
ties it to the active boundary. This was implied by the placeholder allow-list and the "Default
Scoped Role Rules" prose; it is a normative rule:

- The rules below bind rules held by **workspace and project roles**. Platform-role rules are
  exempt from the mandatory scope pair.
- Every **workspace-scoped** subject (`workspace`, `workspaceMember`, `workspaceInvite`,
  `workspaceJoinRequest`) rule held by a workspace role MUST include a `workspaceId` key (`id` for the
  `workspace` subject itself) resolved from
  the `${workspace.id}` placeholder, populated from the request's `x-workspace-id` header on
  user and shared routes and from the validated `:workspaceId` path param on admin routes.
- Every **project-scoped** subject (`project`, `projectMember`) rule's stored condition MUST
  include a `projectId` key (`id` for the `project` subject itself) resolved from the `${project.id}` placeholder, populated from the
  request's `:projectId` route param. This is in addition to the workspace scope a project rule
  already carries transitively, because a project belongs to a workspace.
- Conditions are generated and checked in three steps:
  1. Seeds and the rule DTO build the stored `conditions` through
     `scopedCondition(subject, action, extra?)`, which returns
     `{ [key]: placeholder, ...extra }` from `PolicySubjectScope`. For example, a
     `workspaceMember` rule is stored as `{ "workspaceId": "${workspace.id}" }`.
  2. Rule validation requires every non-inverted rule of a scoped subject to carry
     `conditions[key] === placeholder` at the top level or inside a top-level `AND`. A pair nested
     under `OR` or `NOT` does not count. Inverted rules are exempt.
  3. At request time `PolicyConditionPlaceholderUtil` replaces the placeholder with the resolved
     id, so CASL receives `{ "workspaceId": "<uuid>" }`. Nothing is injected implicitly: the
     stored rule is the single source of truth, and `toWhere` reuses the same condition.
- The mandatory scope pair is waived only for `project:create`. The ability is built from the
  caller's role in the workspace `WorkspaceProtected` already verified, and creation takes its
  `workspaceId` from that same context, so a `workspaceId` condition on the new row could never
  fail. `projectMember:create` (assigning a member) keeps its `projectId` scope but carries no
  member-instance (`id`) condition: holding the permission means "can assign any member in the
  project."
- Operations without a subject (see [Actions](#actions)) need no entry in this rule at
  all: they carry no action, so they have no condition to validate. Listing is a
  query concern — visibility and membership filter the result set directly — not a policy
  decision.

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
    action: EnumPolicyAction[];
    conditions: Prisma.JsonValue | null;
    inverted: boolean;
    reason: string | null;
    priority: number;
}
```

`action` is `EnumPolicyAction[]`. Any (subject, action) pair may be stored. The policy domain
validates `conditions` and `fields` against the subject's model and scope map outside the
database, not the pair itself.

The Prisma `Policy` model keeps `action EnumPolicyAction[]` and gains `conditions Json?`,
`inverted Boolean @default(false)`, `reason String?`, and `priority Int`. The unique constraint
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

The role-policy API exposes a rule request DTO with one subject, action array,
optional conditions, optional inverted flag, optional reason, and an explicit priority. A bulk
replace endpoint may accept an array of that DTO to make ordering transactional. The existing
single-row endpoints retain the same semantics through the new DTO.

## PostgreSQL and Prisma Conditions

Persisted conditions use the Prisma `WhereInput` dialect for the subject's model. They do not use
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
condition columns that do not belong to the target model, unsupported relation paths,
unsupported Prisma operators, and values incompatible with the target field. Conditions are JSON data, not executable expressions.

The adapter builds `PrismaAbility` with `createPrismaAbility`. It uses the subject's derived model name
when deriving `accessibleBy(ability, action)[modelName]`. Repository queries compose that result
with business predicates through `AND`, including active-row and workspace/project predicates.
They never spread an authorization filter into another `where` object.

Object checks use `subject(modelName(subject), record)` with a loaded, typed record.
They do not rely on `constructor` detection for Prisma plain objects.

## Ability Lifecycle

`PolicyDomain` owns ability construction and evaluation. It provides:

```ts
buildForRequest(context: IPolicyRequestContext): IPolicyAbility;
getCurrentAbility(): IPolicyAbility;
can(action: EnumPolicyAction, subject: IPolicySubjectInput): boolean;
assertCan(action: EnumPolicyAction, subject: IPolicySubjectInput): void;
toWhere(action: EnumPolicyAction, subject: EnumPolicySubject): Prisma.JsonObject;
```

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

## Object Enforcement

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

## Workspace and Project Policy Matrix

The following CASL decisions are added incrementally after the existing workspace and project
guards succeed.

| Operation group                                | Subject                | Actions                                                                      | Existing boundary context                                | Notes                                              |
| ------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------- |
| Workspace list/create/switch/leave | none | none | authenticated user; switch and leave need membership in the target workspace | No CASL metadata. List result set filtered by membership/visibility as a query concern (§5). |
| Workspace get (user and admin) | `workspace` | `read` | workspace member (user) or platform admin | `workspaceId` condition per §5; admin routes resolve it from `:workspaceId`. |
| Workspace update/visibility/slug/delete | `workspace` | `update`, `delete` | current workspace member | `workspaceId` condition per §5. |
| Ownership transfer | `workspace` | `manage` | current workspace membership | `workspaceId` condition per §5. |
| Member list | none | none | current workspace member | No CASL metadata; membership is the gate. |
| Member role/remove | `workspaceMember` | `update`, `delete` | current workspace and member | `workspaceId` condition per §5. |
| Invite list/claim | none | none | current member (list) or token-verified invite claimant (claim) | No CASL metadata. |
| Invite create/resend/revoke | `workspaceInvite` | `manage` | current workspace member | `workspaceId` condition per §5. |
| Join request create/list | none | none | public workspace requester (create) or current workspace member (list) | No CASL metadata. |
| Join request accept/reject | `workspaceJoinRequest` | `update` | current workspace member | `workspaceId` condition per §5. |
| Project list (user) | none | none | current workspace member | No CASL metadata; result set filtered by visibility as a query concern. |
| Admin workspace/project list and workspace member list | `workspace` / `project` | `read` | platform admin | Platform-role rule, no scope condition; admin get uses `:workspaceId`/`:projectId` per §5. |
| Project get/update/slug/delete | `project` | `read`, `update`, `delete` | current workspace and project membership | `projectId` condition per §5 (`id` on the project row). |
| Project create | `project` | `create` | current workspace member | No scope condition (§5 exception). |
| Project member list | none | none | current project member | No CASL metadata; membership is the gate. |
| Project member role/remove | `projectMember` | `update`, `delete` | current workspace, project, and project membership | `projectId` condition per §5. |
| Project member assign | `projectMember` | `create` | current workspace, project, and project membership | `projectId` condition, no member-instance condition (§5 exception). |
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
| `owner`  | workspace | `workspace`: `manage`; `workspaceMember`: `update`, `delete`; `workspaceInvite`: `manage`; `workspaceJoinRequest`: `update`; every `project` and `projectMember` action |
| `admin`  | workspace | `workspace`: `read`, `update`; `workspaceMember`: `update`, `delete`; `workspaceInvite`: `manage`; `workspaceJoinRequest`: `update`; `project`: `create`, `delete`                     |
| `member` | workspace | `workspace`: `read`                                                                                                                                                                                                                                                        |
| `admin`  | project   | `project`: `read`, `update`; `projectMember`: `create` (no member-instance condition, §5 exception), `update`, `delete`                                                                                                                                               |
| `member` | project   | `project`: `read`                                                                                                                                                                                                                                                            |
| `viewer` | project   | `project`: `read`                                                                                                                                                                                                                                                            |

The workspace `admin` role has the project actions granted directly by the current route guards.
It does not receive project read or update authority through its workspace role; those actions
require a project membership. The workspace `owner` role retains project authority through its
workspace-scoped CASL rules.

Project and project-member listing are gated by workspace and project membership alone, so no
role carries a `projectMember` `read` rule.

Role administration uses the existing `role` subject. Platform administrators can read the
complete preset catalog and update role display metadata and ordered policy rows. Role creation,
deletion, key changes, and scope changes are not exposed. Workspace owners, workspace admins,
and project admins cannot administer roles or policies.

Policy updates validate each rule's subject against the role's scope using the scope map.
Platform roles may hold any subject and carry no mandatory scope pair, workspace roles hold
platform-level, workspace-level, and project-level subjects, and project roles hold project-level
subjects only. The
workspace `owner` role remains the only role recognized by ownership-transfer and last-owner
domain invariants.

Workspace creation, join-request creation, and invite claim happen before a workspace
membership exists, so they carry no CASL rule and no base authenticated-user grant. The
join-request domain verifies that the target workspace is public and that the caller is not
already a member. Invite claim is token-verified; the authenticated caller and the invite token
are both required.

Member, invite, and join-request listing are gated by workspace membership alone.

Workspace switching and workspace/project leave are membership-derived operations. The switch
domain validates membership for the selected workspace; leave routes resolve the current caller's
membership row and remove that row. These operations do not consult CASL.

The existing domain rules remain in force after a scoped role grants the action: an owner cannot
be removed through a peer operation, the last owner cannot leave, and role-transition validation
continues to protect membership invariants.

## Initial Seed Rules

The initial policy seed is explicit rather than derived from every enum member.

- `superAdmin`: `manage` on `all`.
- `admin`: platform-management rules plus `read` on `workspace` and `project` for existing
  admin-scope endpoints (the admin workspace member list is gated by `workspace:read`).
  Additional actions are added only with matching admin endpoints.
- `user`: seeds no workspace-family rule. Workspace `list`/`create`, invite `claim`, and
  join-request `create` carry no CASL permission.
- Workspace roles: seed `owner`, `admin`, and `member` once with the workspace rows in the scoped
  role matrix.
- Project roles: seed `admin`, `member`, and `viewer` once with the project rows in the scoped
  role matrix (`projectMember:create` is the §5 exception: `projectId` condition only, no
  member-instance condition).

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

- Add rule columns, priority constraint/indexes, the new `EnumPolicySubject` values, and
  generated client updates. `Policy.action` stays `EnumPolicyAction[]`, stored as-is; the
  policy domain validates scope conditions, not the (subject, action) pair.
- Replace the one-subject-per-row DTO and response shape with the rule DTO.
- Update repository reads, writes, policy routes, seed data, and schema migration.
- Migrate existing rows to deterministic priorities and seed the super-admin `manage/all` rule.

### Phase 4: Typed Prisma Ability

- Add the subject scope map, condition validator, placeholder resolver, and typed Prisma ability.
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

### Phase 7: Explicit Actions

- Normalize actions to `EnumPolicyAction` (CRUD plus `manage`), then add
  policy metadata to every permission-controlled endpoint, including the mandatory
  `workspaceId`/`projectId` scope placeholder per subject and its documented exceptions.
- Update role-policy API examples and durable authorization documentation with the shipped
  behavior.

## Test Matrix

- Rule DTO validation: enum values, priority, Prisma operators, relation paths,
  placeholders, role-scope validation from the scope map, mandatory scope-placeholder presence per scoped
  subject (with the `project:create` waiver and the member-instance-free
  `projectMember:create` rule), and unsafe object keys.
- Ability factory: allow, deny, ordered precedence, condition resolution, `manage/all`, and
  immutable CASL rule arrays.
- Policy domain: request-scoped reuse, `can`, `assertCan`, object subjects,
  and Prisma `where` generation.
- Guards: static metadata, missing context, platform policy behavior, workspace/project stacking,
  scoped-role resolution, and no admin dependency on a workspace header.
- Workspace/project domains: workspace and project boundaries remain active before capability checks;
  unauthorized mutations use constrained database predicates; owner and peer-management
  invariants survive role-policy changes.
- Permission inventory: every permission-controlled operation maps to one subject/action pair;
  the operations listed under Actions as needing no permission (workspace list/create/switch/
  leave, member/invite/join-request list, invite claim, join-request create) stay
  membership- or authentication-only, and a plain workspace member can list members, invites,
  and join requests.
- Seed data: platform, workspace, and project role sets map to valid subjects, scopes (per the scope map),
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
- The subject scope map separately covers workspace, workspace member, workspace invite,
  workspace join request, project, and project member resources before they accept persisted
  rules.
- Every permission uses `EnumPolicyAction` (`manage`, `read`, `create`, `update`, `delete`);
  privileged operations such as ownership transfer and invite resend/revoke map to `manage`. The
  persisted `action` column is a typed `EnumPolicyAction[]`.
- The ability is request-scoped and the super-admin role evaluates through CASL.
- `@RoleProtected()`, `RoleGuard`, and the super-admin bypass are removed after equivalent CASL
  metadata covers their routes.
- Workspace members, project members, and invitations reference scoped roles; the role enums and
  their hard-coded permission guards are removed.
- Only platform administrators can update preset roles and policies. Workspace/project role
  administration and custom roles are outside the first version.
- Workspace and project guards remain resource boundaries.
- Every permission-controlled operation has explicit CASL policy metadata and a domain assertion.
- Workspace list/create/switch/leave, project leave, member/invite/join-request list, invite
  claim, and join-request create use authentication, membership, and domain invariants without a
  CASL permission.
- Object and query enforcement are introduced only with their matching domain and
  repository behavior.
- Seeds, DTOs, OpenAPI responses, activity contracts, and tests move with every new action or
  subject.
- Workspace-scoped and project-scoped subject rules carry their mandatory `workspaceId`/
  `projectId` condition, except the documented `project:create` exception.
- Operations without a subject require no policy metadata: no subject, no action, no
  condition.
