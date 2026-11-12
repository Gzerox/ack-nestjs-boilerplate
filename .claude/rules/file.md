# File — upload, CSV import, export, object storage

`FileService` and the file pipes are the shared kit in `src/common/file/`; `ObjectStorageService`
and the stored-upload decorators are the shared kit in `src/common/storage/`. A feature never
re-implements either. Flow narrative: `docs/file-upload.md` (parsing, pipes, CSV) and `docs/storage.md` (disks, signed uploads) — explorer or planner.

## Upload validation is a pipe, never inline

A memory-backed upload (`FileUploadSingle`, `FileUploadMultiple`, `FileUploadMultipleFields`) is validated by a `src/common/file/pipes/` pipe, composed on the route — not by an `if` inside the controller or service. It is for a file the request parses and discards, such as a CSV import. A file that is KEPT is a stored upload (below).

- **Extension is an allow-list, checked against `EnumFileExtension`** (`file.enum.ts`, grouped `Image` / `Document` / `Audio` / `Video` / `Template`). Never match a raw string; add the extension to the right group enum first.
- **The declared extension and the bytes must both agree with the allow-list.** `FileExtensionPipe` reads the extension from `originalname`, then sniffs the buffer through `FileService.sniffExtensionFromBuffer`. A sniffed type is accepted when `FileExtensionContract` (`contracts/file.extension.contract.ts`) maps it onto a member of the allow-list. `csv` is the signature-less member: a sniff that returns nothing is accepted for it, and rejected for every other member. `hbs` is not in that table — it is not an upload. Adding an uploadable extension to a group enum means adding its row to that table.
- **A multi-file upload is validated element by element**, and one rejected file rejects the request.
- A failed upload throws the typed file exception (`FileRequiredException`, `FileExtensionInvalidException`, …), never a bare `BadRequestException` — same rule as everywhere (`rules/exceptions.md`).
- Do not read `file.buffer` in a controller. The pipe owns parsing; the controller receives the parsed result.

## Transport limits are the framework's, the exceptions are ours

`FileUploadSingle`, `FileUploadMultiple` and `FileUploadMultipleFields` compose `FileUploadErrorInterceptor` outermost, ahead of the multer interceptor it wraps. It maps every multer and busboy limit failure onto a typed file exception — `FileExceedMaxSizeUploadException` (`413`), `FileExceedMaxFilesException`, `FileFieldUnexpectedException`, `FileMultipartInvalidException` — so a client reads the same envelope, status code and i18n message as it does for any other file error.

**OpenAPI for multipart lives on the upload decorators** — these three and `StorageUploadSingle`. Each emits `ApiConsumes('multipart/form-data')`, a binary `ApiBody` built from the declared field name(s), and the upload error kit. There is no separate request-doc decorator for uploads (`rules/http.md`).

- The mapping matches the message strings Nest already put on the `HttpException` (`multerExceptions` / `busboyExceptions` from `@nestjs/platform-express`). It does not invent a second message catalog. The client message is the typed exception's own path (`file.error.exceedMaxSizeUpload`, …). `transformException` appends ` - <field>` to several of those framework messages, so the match is the segment before the first ` - `.
- `FileSizeInBytes` is the default per-file cap; `FileMaxMultiple` is the default file count for `FileUploadMultiple`. `FileUploadMultipleFields` takes its counts from the fields it declares.
- `FileUploadMultipleFields` derives its global `files` limit from the sum of the declared per-field `maxFiles`, so the global limit admits exactly what the per-field caps allow.

## CSV import — the two-pipe chain

A CSV import endpoint composes two pipes in order, and the order is the contract:

1. **`FileCsvParsePipe<T>`** — validates the upload is a non-empty `.csv` and parses the UTF-8 buffer into raw rows via `FileService.readCsv`.
2. **`FileCsvValidationPipe(schema)`** — validates every parsed row against a zod schema, collecting per-row failures into a `FileImportException` carrying `{ row, errors }[]`.

- **Row errors are collected, never fail-fast.** `FileCsvValidationPipe` validates every row and reports all failures at once — do not rewrite it to throw on the first bad row.
- **`file.maxDataImport` (config) is the row cap**, overridden per module through `maxDataImportConfigKey` (`user.maxDataImport`). Exceeding it throws `FileExceedMaxDataImportException`. An unbounded import loads an attacker-controlled row count into memory — the cap is a limit, not a suggestion.
- `FileImportException` is `@Catch`-ed by `app.validation-import.filter.ts` (first in the filter chain, `rules/exceptions.md`). It maps to `422` with row-scoped errors and reports **no Sentry** — a bad upload is a client error. Do not route import errors anywhere else.
- The import shape is a normal request schema (`rules/validation.md`), and the pipe is handed that schema; an unknown column is rejected the same way an unknown body key is.

## CSV and PDF export — capped, then streamed

A controller returning `IResponseFileReturn` hands `ResponseFileInterceptor` a finished buffer; the interceptor caps it, sets the download headers, and wraps it in a `StreamableFile`.

- **The row cap belongs to the domain that produces the rows.** `file.maxDataExport`, overridden per module the way the import cap is (`user.maxDataExport`). The query asks for `cap + 1` rows and the domain throws `FileExceedMaxDataExportException` when it gets them, before a single row is formatted.
- **`file.maxSizeExportInBytes` is the backstop.** `ResponseFileInterceptor` measures the finished buffer and throws `FileExceedMaxSizeExportException`. It runs once the buffer exists, so it stops the send rather than the allocation — the row cap is what keeps memory bounded, and this covers the branches that have no row to count.
- **`Content-Disposition` is built, never interpolated.** The filename passes through `FileService.sanitizeFilename` for the quoted `filename=` and through `encodeURIComponent` for `filename*=UTF-8''`. A filename that reaches the header raw is a header-injection defect, not a formatting detail.
- The headers are handed to `StreamableFile` as `{ type, disposition, length }`; `ResponseMetadataService.setHeaders` adds the `x-*` metadata alongside them.

## Object storage — `ObjectStorageService` is the only surface

Storage is `src/common/storage/` on `@nestjs/storage`, with two named disks: `public` (every upload, delivered without authentication) and `private` (protected documents). `STORAGE_DRIVER` selects the implementation — `local` is `LocalDisk` under a gitignored root, `s3` is `S3Disk` for AWS S3 and S3-compatible providers (R2: an endpoint and region `auto`). Unit specs use `InMemoryDisk`. Which driver runs in which environment is the deployer's choice. Config validation fails startup only when the chosen driver's configuration is incomplete, so storage is always available — there is no initialized/disabled mode to check.

- **A feature reaches storage through `ObjectStorageService` and nothing else** — `publicUrl`, `toAssetResponse`, `createSignedUpload`, `signedDownload`, `verifyUpload`, `store`, `createUploadEngine`, `deleteQuietly`, `delete`, `deletePrefix`, `probe`. A feature never injects a package disk, never imports `LocalDisk`, `S3Disk` or an AWS SDK command, and never catches a package `Storage*Error`: the service translates every one into a typed `storage` exception (`rules/exceptions.md`).
- **Visibility is server-controlled.** `EnumStorageVisibility` (`public` / `private`, from `@generated/prisma-client/client`) names both the access policy and the disk. The feature's semantics choose it; a request body never carries it, and never carries a disk, a bucket, or a final key. Where the right value is not obvious, it is `private` — a `public` object is readable by anyone holding its URL.
- **A stored asset persists `key`, `visibility`, `contentType`, `size` (`BigInt`), and `etag` (nullable)** — logical identity only. A bucket, a public or signed URL, an endpoint, a CDN host, or a local path never reaches the database, so a row survives a change of driver, host, or credentials.
- **URLs are resolved at runtime, in the HTTP service, through one helper** — `ObjectStorageService.toAssetResponse` — before the response is validated. The response schema stays pure and only declares `url` (`rules/dto.md`). A public asset carries its `publicUrl`; a private asset carries `url: null`. `publicUrl` on a private asset throws. Wherever a `size` reaches the wire it converts to a number only through a safe-integer check that throws `sizeInvalid` above `Number.MAX_SAFE_INTEGER`.
- **An embedded stored asset is `{ key, visibility, contentType, url }`** — a user `photo` inside a user, session, device, member, password-history, or activity-log response. Its `size` and `etag` stay in the database. The photo type changes at its single source (the user reference select and the photo DTO type); every projection that embeds it keeps its own interface name and shape (`IActivityLog`, `IDeviceOwnershipDetail`, `ProjectMember`, …), with no `I*Response` twin per projection.
- **A private object is delivered by `signedDownload`, after authorization**, as `{ url, expiresAt }`; no route uses it while every feature stores public. The URL is a bearer credential that cannot be revoked, so the authorization check comes first and the lifetime stays short.
- **Every key is server-generated, random, and never reused.** The package has no conditional put, so a write never follows an existence check (`rules/concurrency.md`); the random key is what keeps two writers apart.

## Stored multipart upload — streamed, never buffered

A file the API keeps is uploaded through `@StorageUploadSingle({ fieldName, visibility, scopePrefixPatternConfigKey, maxSizeInBytesConfigKey, extensions })`, and the controller receives `@StoredUpload()` — an `IStoredAsset`, never a buffer.

- The interceptor streams the part to the disk for `visibility` through `uploadToDisk`, which enforces the size the config key resolves to and detects the type from the bytes before committing. A type outside `extensions` (`EnumFileExtension` members) is rejected and nothing is kept; an oversize stream is rejected and its partial object removed.
- **The key is `<scopePrefix><uuid>.<ext>`, and `ext` comes from the DETECTED content type**, never from the client filename.
- The domain persists the returned metadata. A failed database write deletes the new object; the replaced object is deleted only after the write commits (below).

## Direct upload — signed, verified in place

A direct upload means the client PUTs straight to the disk with a signature the API issues; the API never proxies those bytes. A signed upload is not an asset until completion verifies it: the object already sits at its final key on the public disk, with no staging area and no copy.

- **Issue.** The request declares only a content type (or extension) and a size; the request schema bounds the size structurally (a positive integer) and `createSignedUpload` rejects a size below 1 and the domain rejects one above the configured maximum. `createSignedUpload(scope, { contentType, size })` builds a random key under `<scope>/` on the public disk and always pins `contentLength`, so the signature fixes the size. The response is `{ key, url, method: 'PUT', headers, expiresAt }`, and the client sends that method and those headers exactly.
- **Complete.** The completion body is `{ key }` and nothing else — never a size, a type, or a visibility. `verifyUpload(key, { scopePrefix, maxSizeInBytes, contentTypes, detect? })` checks the key FIRST: a `..` segment, an absolute-looking key, or a prefix other than the caller's own scope is `keyInvalid`, and the object is never read. Then `stat()` gives the real size and a byte sniff gives the real type; a text format with no signature (a template) passes a feature-supplied `detect`. A missing object is `objectNotFound`.
- **A rejected object is deleted best-effort** through the one `ObjectStorageService.deleteQuietly`, never a per-feature copy; a detected type that differs from the one the key's extension implies is rejected too. An upload that is never completed stays: no prefix separates it from a verified asset, so no lifecycle rule can expire it.
- **Verify, then write, then clean up.** The repository writes the verified metadata under the key the signature named. A failed write deletes the uploaded object and rethrows. After the write commits, any replaced object is deleted, never the one just written — a cleanup failure is logged and the request still succeeds.
- Two completions of one key are not locked: both verify the object and write the same row.
- Every upload-issuing and upload-completing endpoint, and every stored multipart upload, carries `@RequestThrottle({ user: true, route: EnumRequestThrottleRoute.moderate })` (`rules/http.md`).

## Storage and PostgreSQL share no transaction

Each workflow has one authoritative state and an explicit compensation.

- **No database reference is written before its object is verified and written.** No authoritative object is deleted before the database reference that replaces it commits.
- **Removal writes the database first, then deletes the object** (`delete`, or `deletePrefix` for a whole aggregate). A storage failure after the commit is logged, never rolled back into the domain.

## Signatures, limits, and logs

- **A signed upload or download URL is a credential** (`rules/security.md`): it never lands in a log line, in activity metadata, or on `request.<field>`. Return it in the response and nowhere else. A storage log names the logical disk, the key, the operation, and the provider error code — never a signed URL, a credential, a provider response body, or a local absolute path.
- **TTLs are `storage` config, bounded and short** — signed download 5 minutes, signed upload 2 minutes by default. Do not widen one to "make testing easier".
- **A size cap and a scope prefix pattern are literals in the owning feature's config file** (`rules/config.md`) — `user.photo.maxSizeInBytes` is 10 MB, term-policy template content is 1 MB. A decorator receives the config KEY; a domain reads the value through `ConfigService`.

## Local-driver routes

`StorageLocalController` exists so the absolute URLs the API returns resolve under `STORAGE_DRIVER=local`: it serves the public disk, verifies signed private downloads, and receives signed uploads into the public disk. It is not an API endpoint.

- **It is the one controller registered outside `src/router/`.** `StorageMainModule` registers it unconditionally, so it mounts under the global prefix and outside the five router scopes. A driver guard answers 404 on every route unless the driver is `local`, so a remote deployment exposes none of them.
- It carries `@ApiExcludeController` and no API-key, auth, or user-throttle guard — a browser follows the URL without the API headers. The signature is the guard.
- The key travels as an Express 5 wildcard parameter (`*key`) because keys contain `/`. The signed-upload route is excluded from `RequestBodyParserMiddleware` so `receiveSignedUpload` gets the raw body.
- The file-serving routes set `Cross-Origin-Resource-Policy: cross-origin` over the global Helmet default, and the public route sets `Cache-Control: public, max-age=31536000, immutable` — keys are never reused.

## Health

`ObjectStorageService.probe` runs `disk.list({ limit: 1 })` under an abort signal of about 3 seconds — one cheap request, valid on an empty bucket, writing nothing. The storage health check reports `storagePublic` and `storagePrivate`, never a bucket name, on `/system/health/storage`; `/system/health/aws` covers SES only.
