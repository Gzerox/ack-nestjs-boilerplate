# Pagination Ideas

## Purpose

This document records two proposed pagination extensions as implementation specs:

- per-endpoint `defaultOrderBy`
- per-endpoint `defaultMaxPerPage` for offset pagination

This note is written against the committed pagination baseline and intentionally ignores current local changes in `src/common/pagination/pipes/pagination.order.pipe.ts`.

## Current Baseline

### Ordering

Current committed behavior:

- `PaginationOffsetQuery(...)` and `PaginationCursorQuery(...)` forward only `availableOrderBy` into `PaginationOrderPipe`
- `PaginationOrderPipe` reads request `orderBy` from the query string
- if request `orderBy` is missing, it falls back to `PaginationDefaultOrderBy`
- if `availableOrderBy` is missing or empty, the pipe also falls back to `PaginationDefaultOrderBy`
- there is no per-endpoint way to declare a custom fallback sort order

Example of current request input:

```http
GET /endpoint?orderBy=createdAt:desc
```

### Offset Pagination Limits

Current committed behavior:

- `PaginationOffsetPipe(defaultPerPage?)` supports endpoint-specific `defaultPerPage`
- max `perPage` is always the global `PaginationDefaultMaxPerPage`
- there is no per-endpoint way to lower or raise the max cap for a specific endpoint

## Proposal 1: `defaultOrderBy`

### Goal

Allow controllers to define a per-endpoint fallback sort order directly on the pagination decorators.

Example target API:

```ts
@PaginationOffsetQuery({
    availableOrderBy: ['publishedAt', 'version'],
    defaultOrderBy: [{ publishedAt: EnumPaginationOrderDirectionType.desc }],
})
```

The same behavior should apply to `@PaginationCursorQuery(...)`.

### Intended Behavior

- `defaultOrderBy` is optional
- if request `orderBy` is missing or empty, use:
  1. `options.defaultOrderBy` when provided
  2. `PaginationDefaultOrderBy` otherwise
- if the client sends an explicit `orderBy`, the request value wins
- if `availableOrderBy` is configured, both:
  - request `orderBy`
  - configured `defaultOrderBy`
  must use only allowed fields
- `PaginationService` may keep its own global fallback as a defensive last layer

### Expected Code Shape

- add `defaultOrderBy?: IPaginationOrderBy[]` to:
  - `IPaginationQueryOffsetOptions`
  - `IPaginationQueryCursorOptions`
- update `PaginationOffsetQuery(...)` to pass `defaultOrderBy` into `PaginationOrderPipe(...)`
- update `PaginationCursorQuery(...)` to pass `defaultOrderBy` into `PaginationOrderPipe(...)`
- update `PaginationOrderPipe(...)` signature to accept:
  - `defaultAvailableOrder?: string[]`
  - `defaultOrderBy?: IPaginationOrderBy[]`
- resolve the fallback inside the pipe before returning the final transformed `orderBy`
- validate configured fallback fields against `availableOrderBy` when the allowlist exists

### Test Cases

- no request `orderBy` and custom `defaultOrderBy` returns the custom fallback
- explicit request `orderBy` overrides the configured fallback
- configured `defaultOrderBy` using a field outside `availableOrderBy` throws `orderByNotAllowed`
- no configured `defaultOrderBy` still falls back to `PaginationDefaultOrderBy`
- cursor pagination follows the same rules

## Proposal 2: `defaultMaxPerPage`

### Goal

Allow `PaginationOffsetPipe` to define a per-endpoint maximum `perPage` limit.

Example target API:

```ts
@PaginationOffsetQuery({
    defaultPerPage: 20,
    defaultMaxPerPage: 50,
})
```

### Intended Behavior

- `defaultMaxPerPage` is optional
- if not provided, it falls back to `PaginationDefaultMaxPerPage`
- `perPage` validation becomes endpoint-aware:
  - minimum remains `1`
  - maximum becomes `defaultMaxPerPage ?? PaginationDefaultMaxPerPage`
- error payloads should report the effective max for that endpoint
- `defaultPerPage` must not exceed the effective max

### Expected Code Shape

- add `defaultMaxPerPage?: number` to `IPaginationQueryOffsetOptions`
- update `PaginationOffsetQuery(...)` to pass `defaultMaxPerPage` into `PaginationOffsetPipe(...)`
- update `PaginationOffsetPipe(...)` signature to accept:
  - `defaultPerPage = PaginationDefaultPerPage`
  - `defaultMaxPerPage = PaginationDefaultMaxPerPage`
- use the effective max in:
  - `invalidPerPage` metadata
  - `perPageExceedsMaximum` metadata
  - JSDoc constraints
- validate startup-time assumptions inside the pipe factory path:
  - `defaultMaxPerPage >= 1`
  - `defaultPerPage >= 1`
  - `defaultPerPage <= defaultMaxPerPage`

### Test Cases

- request without `perPage` uses `defaultPerPage`
- request `perPage` above endpoint max throws `perPageExceedsMaximum`
- request `perPage` equal to endpoint max is accepted
- missing `defaultMaxPerPage` still uses `PaginationDefaultMaxPerPage`
- invalid configuration where `defaultPerPage > defaultMaxPerPage` throws immediately

## Note On Inline Default For `defaultAvailableOrder`

We should not introduce a default allowlist in `PaginationOrderPipe` unless we intentionally want a semantic change.

Why:

- `defaultAvailableOrder` is an allowlist, not a fallback order
- defaulting it to `[]` adds no value because `undefined` and empty already behave the same
- defaulting it to a real field list such as `['createdAt']` would silently change endpoints that currently have no allowlist
- that would make ordering behavior less explicit and could conflict with per-endpoint `defaultOrderBy`

Recommended approach:

- keep `defaultAvailableOrder` optional
- use `defaultOrderBy` for fallback sort behavior
- add `defaultMaxPerPage` independently in `PaginationOffsetPipe`
