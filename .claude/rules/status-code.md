# Status codes

A status code is the `statusCode` field on `AppBaseException`, surfaced in `ResponseErrorDto` beside `statusCodeKey` and `module`. It is **not** an HTTP status — `httpStatus` is a separate field.

**The enum files are the machine registry.** Scan them before allocating; never invent a number from memory. This rule file is the procedure and the human layout. Durable prose about error *behavior* stays in `docs/handling-error.md` / `docs/message.md`.

```bash
find src -name '*.status-code.enum.ts' | sort | while read -r f; do
  echo "== $f"
  grep -oE '= [0-9]+' "$f" | tr -d '= ' | sort -n | sed -n '1p;$p'
done
```

---

## Digit width (HARD)

| Rule | Detail |
|---|---|
| **All new status codes are 5 digits** | `51000`, `52014`, never a new 4-digit value |
| **New module blocks are 5-digit bases** | Prefer contiguous hundreds (e.g. `53000`–`53099`) |
| **Existing 4-digit enums are legacy** | Do not grow them with new 4-digit members. A new member on a legacy module still uses the next free number **only if** it stays inside that module's reserved legacy span and the owner has not yet migrated the block; prefer scheduling a 5-digit renumber for that module |
| **Target** | Every status code in the repo becomes 5 digits. Renumbering live integers is a client-visible contract change — do it only when the owner schedules it |

---

## Current layout (snapshot — verify by scan)

| Range (legacy 4-digit) | Owner |
|---|---|
| 5000 | `src/app` — `EnumAppStatusCodeError` |
| 5010–5013 | `src/common/file` |
| 5020–5035 | `src/common/pagination` (**overruns** request base — known collision) |
| 5030–5034 | `src/common/request` |
| 5040–5041 | `session` |
| 5060–5064 | `role` |
| 5080–5085 | `feature-flag` |
| 5100–5108 | `api-key` |
| 5120–5136 | `auth` |
| 5140–5143 | `country` |
| 5150–5176 | `user` |
| 5180–5182 | `policy` |
| 5200–5203 | `notification` |
| 5220 | `device` |
| 5240 | `src/common/aws` |
| 6100–6108 | `term-policy` |

| Note | Detail |
|---|---|
| Collision | `EnumPaginationStatusCodeError` (5020–5035) overlaps `EnumRequestStatusCodeError` (5030+). Do not paper over it. Report; renumber only with owner approval |
| Next free 5-digit region | After scan, claim the next free hundred (e.g. `53000`) that does not collide. Prefer `5xxxx` for feature modules |

---

## Before anything — reuse?

| Step | Action |
|---|---|
| 1 | Open the module's existing `*.status-code.enum.ts` |
| 2 | Find a member that already means what you need |
| 3 | Add a new member only when nothing fits |

Duplicate near-synonyms (`notFound` beside `entryNotFound`) are waste.

---

## Add a member (existing block)

| Step | Action |
|---|---|
| 1 | Scan (command above) — real low/high and neighbour base |
| 2 | Check headroom — stop and report if the next number collides |
| 3 | Append the next sequential number — no gaps |
| 4 | Name = bare camelCase descriptor (`notFound`, `passwordExpired`) |
| 5 | Create one exception class file under `exceptions/` |
| 6 | Add nested i18n key in **every** `src/languages/<lang>/<module>.json` |
| 7 | Pick `httpStatus` deliberately (wire status **and** Sentry predicate: filter reports at 500+) |
| 8 | Record the change in `generated/docs/report-coder-<feature>.md` for the owner |

Exception shape:

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

---

## Claim a block (new module)

| Step | Action |
|---|---|
| 1 | Scan — highest allocated block and gaps |
| 2 | Take the next free **5-digit** hundred that does not overlap a neighbour |
| 3 | Create `enums/<module>.status-code.enum.ts` with the first member at the block base |
| 4 | Report the claim in `generated/docs/report-coder-<feature>.md` (module, base, next free, members) |

---

## Remove a member

| Step | Action |
|---|---|
| 1 | Delete the enum member and its exception file |
| 2 | Renumber the rest of the block contiguously (by member name references) |
| 3 | Remove the i18n key from every language file |
| 4 | Report the client-visible integer shift in `generated/docs/report-coder-<feature>.md` |

Clients should key on `module` + `statusCodeKey`, not the raw integer.

---

## Move a code between modules

| Step | Action |
|---|---|
| 1 | Add to the destination block (sequential + i18n) |
| 2 | Delete from the source block and renumber that block |
| 3 | Repoint every exception, spec, and translation key |
| 4 | Report the contract change on **both** sides |

---

## Verify

| Check | Command / reading |
|---|---|
| No numeric literals | `grep -rn 'statusCode = [0-9]' src/` — must be empty |
| Member used | `grep -rn '<descriptor>' src/modules/<module>/ src/languages/` |
| Contiguous | Members run from block base without holes |
| Key matches number | `statusCodeKey` reverse-looks-up the same member as `statusCode` |
| i18n nested | `messagePath` resolves in every language file |
| Digit width | New values are 5 digits |

Record block claims and renumbers in `generated/docs/report-coder-<feature>.md`. Quoted numbers in `docs/*.md` are updated from that report — never invent a second registry file under `docs/` for the enum integers themselves.
