---
name: status-code
description: Allocate, reuse, renumber, or retire an application status code in ack-nestjs-boilerplate. Use this whenever you are about to add a new exception class, add or remove a member of a `*.status-code.enum.ts`, claim a numeric block for a new module, or when a status-code number appears to have shifted or collided. The enum member, the exception class, and the i18n key must move together, and the number is a client-visible contract, so do not do any of this from memory.
---

# Status code allocation

A status code is the `statusCode` field on `AppBaseException`, surfaced in the `ResponseErrorDto` alongside `statusCodeKey` and `module`. It is NOT an HTTP status code — `httpStatus` is a separate field on the same exception.

**There is no separate registry file. The enum files ARE the registry.** Every allocation decision is made by scanning them, never from memory:

```bash
find src -name '*.status-code.enum.ts' | sort | while read -r f; do
  echo "== $f"; grep -oE '= [0-9]+' "$f" | tr -d '= ' | sort -n | sed -n '1p;$p'
done
```

That gives every block's low and high in one pass. Run it before allocating anything.

## Current block layout

| Range | Owner |
|---|---|
| 5000 | `src/app` — system reserve (`EnumAppStatusCodeError`) |
| 5010 | `src/common/file` |
| 5020 | `src/common/pagination` |
| 5030 | `src/common/request` |
| 5040 | `session` |
| 5060 | `role` |
| 5080 | `feature-flag` |
| 5100 | `api-key` |
| 5120 | `auth` |
| 5140 | `country` |
| 5150 | `user` |
| 5180 | `policy` |
| 5200 | `notification` |
| 5220 | `device` |
| 5240 | `src/common/aws` |
| 6100 | `term-policy` |

Blocks are nominally 20 wide. Verify against the scan before trusting this table — a block that has grown past its neighbour's base is a collision, and this table is a snapshot.

> **Known collision, do NOT paper over it:** `EnumPaginationStatusCodeError` runs 5020-5035 and overruns `EnumRequestStatusCodeError`'s 5030 base. Five numbers are claimed twice, and `EnumRequestStatusCodeError` also has a gap at 5033. Fixing it is a client-visible renumber and needs the owner's decision — report it, do not silently renumber.

## Before anything: can you reuse?

Read the module's existing enum and look for a member that already means what you need. A new code is only justified when none fits. Duplicate near-synonyms (`notFound` beside `entryNotFound`) make the error surface unreadable and are the most common waste here.

## Adding a member to an existing block

1. **Scan** (command above) to get the module's real low and high, and its neighbour's base.
2. **Check headroom.** If the next sequential number would reach the neighbour's base, STOP and report — you are one member away from a collision. Widening a block is the owner's call.
3. **Append at the next sequential number.** No gaps, ever. The sequence runs contiguously from the block base.
4. **Name it as a bare camelCase descriptor** — `notFound`, `passwordExpired`. The enum name and the response's `module` field already scope it, so a `user` prefix inside `EnumUserStatusCodeError` is redundant noise.
5. **Write the exception class**, one per file, at `src/modules/<module>/exceptions/<module>.<kebab-descriptor>.exception.ts`:

```ts
export class <Module><Descriptor>Exception extends AppBaseException {
    readonly module = '<module>';
    readonly statusCode = Enum<Module>StatusCodeError.<descriptor>;
    readonly statusCodeKey = Enum<Module>StatusCodeError[this.statusCode];
    readonly httpStatus = HttpStatus.<MATCHING>;

    constructor() {
        super('<module>.error.<descriptor>');
    }
}
```

6. **Add the i18n key to EVERY language file**, nested, at `src/languages/<lang>/<module>.json`:

```json
{ "error": { "<descriptor>": "..." } }
```

A flat `"error.<descriptor>"` key does not resolve. A missing key in a non-`en` language is a silent fallback for every speaker of it.

7. **Pick `httpStatus` deliberately.** It is both the wire status AND the Sentry predicate — `AppBaseExceptionFilter` reports only at 500 and above. Choosing it chooses whether this failure pages anyone.

## Claiming a block for a new module

1. Scan. Find the highest allocated block and the gaps between existing blocks.
2. Take the next free 20-wide block that does not overlap any neighbour. Prefer extending the contiguous 5xxx region over starting a new one.
3. Create `src/modules/<module>/enums/<module>.status-code.enum.ts` with the first member at the block base.
4. Report the block you claimed in your hand-back so the owner can see the allocation move.

## Removing a member

1. Delete the member and its exception class file.
2. **Renumber the rest of the block contiguously** — the sequence must not develop a hole. This is safe precisely because every reference is by member name.
3. Remove the i18n key from every language file.
4. **Every surviving member's integer after the deleted one shifts.** That is a client-visible change: a frontend keying on the numeric `statusCode` will match the wrong error. Say so explicitly in your hand-back and name what moved. The stable identifier a client should key on is the `module` + `statusCodeKey` pair, not the integer.

## Moving a code between modules

Treat it as a delete in the source plus an add in the destination:

1. Add the member to the destination block (sequential, i18n key added).
2. Delete it from the source block and renumber that block.
3. Repoint every exception class, spec, and translation key.
4. Report the contract change on BOTH sides — the endpoint now returns a different integer, and that is the whole point a client cares about.

## Verify before you finish

```bash
grep -rn 'statusCode = [0-9]' src/          # numeric literals — must return nothing
grep -rn '<descriptor>' src/modules/<module>/ src/languages/
```

Then confirm by reading, not assuming: the members are contiguous from the block base, no number collides with a neighbouring block, `statusCodeKey` reverse-looks-up the same member as `statusCode`, and the `messagePath` resolves to a real nested key in every language file. A mismatched `statusCode` / `statusCodeKey` pair compiles fine and ships an error whose key and number describe different things.
