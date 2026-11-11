# Third Party Integration Documentation

## Overview

Third-party clients are configured through environment variables. Each section below names the package and the env vars.

## Related Documents

- [Configuration Documentation][ref-doc-configuration] - Storage, AWS SES, Firebase, Sentry config keys
- [Environment Documentation][ref-doc-environment] - Credential env vars
- [Authentication Documentation][ref-doc-authentication] - Google and Apple OAuth
- [File Upload Documentation][ref-doc-file-upload] - Stored uploads, signed direct uploads, and the client flow
- [Email Documentation][ref-doc-email] - SES templates and sync
- [Notification Documentation][ref-doc-notification] - Push and email delivery
- [Queue Documentation][ref-doc-queue] - BullMQ workers that call these services
- [Cache Documentation][ref-doc-cache] - Redis used by cache and rate limits
- [Database Documentation][ref-doc-database] - PostgreSQL connection expectations

## Table of Contents

- [Overview](#overview)
- [Related Documents](#related-documents)
- [Object Storage](#object-storage)
  - [Drivers](#drivers)
  - [AWS S3 configuration](#aws-s3-configuration)
  - [Cloudflare R2 configuration](#cloudflare-r2-configuration)
  - [Bucket setup](#bucket-setup)
  - [Browser CORS](#browser-cors)
  - [Lifecycle rules](#lifecycle-rules)
  - [Least-privilege permissions](#least-privilege-permissions)
  - [Encryption at rest](#encryption-at-rest)
  - [Credential and signing-key rotation](#credential-and-signing-key-rotation)
  - [Health and error codes](#health-and-error-codes)
- [AWS Services](#aws-services)
  - [SES Email](#ses-email)
- [Firebase](#firebase)
- [Sentry](#sentry)
- [Redis](#redis)
- [PostgreSQL](#postgresql)
- [Social Authentication](#social-authentication)
  - [Google OAuth](#google-oauth)
  - [Apple Sign In](#apple-sign-in)
- [HashiCorp Vault](#hashicorp-vault)

## Object Storage

[`@nestjs/storage`][ref-nestjs-storage] backs the `storage` kit in `src/common/storage`. The kit registers two named disks, `public` and `private`, and features call `ObjectStorageService` for every storage operation. Upload and delivery flows: [File Upload][ref-doc-file-upload].

**Packages:**
- `@nestjs/storage` (local, S3, and in-memory disks; S3 requests are SigV4-signed `fetch` calls)

| Disk | Holds | Delivery |
|---|---|---|
| `public` | Every upload, readable by anyone holding the URL: profile photos, term policy content; a signed direct upload writes here | Public URL, `STORAGE_PUBLIC_BASE_URL` plus the object key |
| `private` | Protected documents; no feature stores to it today | Short-lived signed URL, issued after authorization |

### Drivers

`STORAGE_DRIVER` selects the implementation. Either driver runs in any environment; the choice belongs to the deployment.

- **`local`** (default) keeps `<STORAGE_LOCAL_ROOT>/public` and `<STORAGE_LOCAL_ROOT>/private` on the API host. The API serves them under `/api/storage` (public files, signed downloads, signed uploads), and the private URLs are signed with `STORAGE_LOCAL_SIGNING_KEYS`. Objects live as long as that directory does, so a multi-instance or ephemeral-disk deployment needs shared, persistent storage behind it. `docker-compose.yml` mounts `./storage-data` into the API container.
- **`s3`** talks to AWS S3 or any S3-compatible service through `STORAGE_S3_ENDPOINT`: Cloudflare R2, MinIO (with `STORAGE_S3_FORCE_PATH_STYLE=true`), and others. One bucket backs each disk, and the provider signs uploads and downloads itself.

Startup validation fails when a variable the chosen driver needs is missing, so a running instance always has working storage. Variable reference: [Environment][ref-doc-environment].

### AWS S3 configuration

```dotenv
STORAGE_DRIVER=s3
STORAGE_PUBLIC_BASE_URL=https://<public-bucket>.s3.<region>.amazonaws.com
STORAGE_S3_ENDPOINT=
STORAGE_S3_REGION=<region>
STORAGE_S3_ACCESS_KEY_ID=<access_key_id>
STORAGE_S3_SECRET_ACCESS_KEY=<secret_access_key>
STORAGE_S3_FORCE_PATH_STYLE=false
STORAGE_S3_PUBLIC_BUCKET=<public-bucket>
STORAGE_S3_PRIVATE_BUCKET=<private-bucket>
```

An empty `STORAGE_S3_ENDPOINT` uses the AWS regional endpoint. With a CloudFront distribution in front of the public bucket, `STORAGE_PUBLIC_BASE_URL` is the distribution URL.

### Cloudflare R2 configuration

```dotenv
STORAGE_DRIVER=s3
STORAGE_PUBLIC_BASE_URL=https://<public-bucket-custom-domain>
STORAGE_S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
STORAGE_S3_REGION=auto
STORAGE_S3_ACCESS_KEY_ID=<r2_access_key_id>
STORAGE_S3_SECRET_ACCESS_KEY=<r2_secret_access_key>
STORAGE_S3_FORCE_PATH_STYLE=false
STORAGE_S3_PUBLIC_BUCKET=<public-bucket>
STORAGE_S3_PRIVATE_BUCKET=<private-bucket>
```

Validation rejects any region other than `auto` for an endpoint ending in `.r2.cloudflarestorage.com`. `STORAGE_PUBLIC_BASE_URL` is the custom domain connected to the public bucket, or its `r2.dev` URL.

### Bucket setup

Buckets are configured in the provider's console or infrastructure code; the API changes no bucket setting.

- **Private bucket.** Block Public Access stays on with all four settings, on AWS. On R2 the bucket has no custom domain and its `r2.dev` URL stays disabled. A client reads a private object only through a signed URL the API issued after an authorization check.
- **Public bucket.** Objects are publicly readable: a bucket policy granting `s3:GetObject` to `*` on `arn:aws:s3:::<public-bucket>/*` (with Block Public Access relaxed for that bucket only), or a CloudFront distribution with origin access control in front of a bucket that stays blocked. On R2, a custom domain or the `r2.dev` URL.
- **Object ownership.** Bucket owner enforced (ACLs disabled). The API sends no ACL.

### Browser CORS

A signed direct upload is a `PUT` from the browser to the public bucket. The public bucket's CORS rule admits `PUT` from the approved frontend origins and the headers the signed upload returns (`content-type`; browsers set `content-length` themselves):

```json
[
  {
    "AllowedOrigins": ["https://app.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

The same JSON applies to an R2 bucket's CORS policy. A frontend that reads public or signed objects with `fetch` (rather than an `<img>` or a link) also needs `GET` and `HEAD` from those origins on the bucket it reads. Under the `local` driver every storage URL is on the API origin, so the API's own CORS settings (`CORS_ALLOWED_ORIGIN`) cover it.

### Lifecycle rules

- **No expiry rule for abandoned direct uploads.** A direct upload is written to its final key on the public bucket. Completion deletes a rejected object best-effort; an upload that is never completed stays, and no key prefix tells it apart from a verified asset, so a prefix lifecycle rule cannot remove it.
- **Incomplete multipart abort on both buckets.** Bodies above 8 MiB go up in parts. A rule aborting incomplete multipart uploads (for example after one day) removes the parts of an upload that never finished.

```json
{
  "Rules": [
    {
      "ID": "abort-incomplete-multipart",
      "Filter": {},
      "Status": "Enabled",
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
    }
  ]
}
```

R2 offers the rule under the bucket's object lifecycle settings.

### Least-privilege permissions

The storage identity needs list, read, write, delete, and multipart abort on the two buckets, and nothing else. On AWS:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::<public-bucket>",
        "arn:aws:s3:::<private-bucket>"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload"
      ],
      "Resource": [
        "arn:aws:s3:::<public-bucket>/*",
        "arn:aws:s3:::<private-bucket>/*"
      ]
    }
  ]
}
```

- `s3:ListBucket` serves the health probe and prefix deletion.
- `kms:GenerateDataKey` and `kms:Decrypt` on the key ARN are added only when a bucket encrypts with SSE-KMS.
- On R2, the API token has **Object Read & Write** permission, scoped to the two buckets.

### Encryption at rest

The API sends no server-side encryption header, so each object takes its bucket's default encryption. AWS S3 encrypts every new object with SSE-S3 by default; a bucket whose default is SSE-KMS encrypts with that key, and the storage identity then needs the KMS permissions above. R2 encrypts every object at rest.

### Credential and signing-key rotation

- **S3 access keys.** AWS allows two active keys per IAM user: create the second key, deploy it to `STORAGE_S3_ACCESS_KEY_ID` / `STORAGE_S3_SECRET_ACCESS_KEY`, then deactivate and delete the first. The values are read at startup, so the new pair takes effect on restart.
- **R2 tokens.** Create a new token with the same scope, deploy it, then revoke the old one.
- **Local signing keys.** `STORAGE_LOCAL_SIGNING_KEYS` is a comma-separated list: the first key signs and every key verifies. `pnpm generate:secret:storage` draws a new key into `keys/storage-secret.env`. With `--direct-insert` it replaces the whole list in `.env`, so local URLs signed with the old key stop verifying. To keep issued URLs valid, put the new key first by hand, restart, and drop the old key once the URLs it signed have expired (10 minutes for an upload, 5 for a download).

A signed URL is a bearer credential that cannot be revoked before it expires, which is why both lifetimes stay short.

### Health and error codes

`GET /system/health/storage` probes each disk with one `list` of at most one key, under a 3-second limit, and reports `storagePublic` and `storagePrivate` without naming a bucket. `GET /system/health/aws` reports SES only.

Storage errors use `EnumStorageStatusCodeError` (`52300`–`52306`, module `storage`); the table is in [Status Codes][ref-doc-status-codes].

## AWS Services

### SES Email

[AWS SES][ref-aws-ses] handles transactional email delivery.

**Packages:**
- `@aws-sdk/client-ses`

**Environment Variables:**
```dotenv
AWS_SES_IAM_CREDENTIAL_KEY=<your_aws_ses_access_key>
AWS_SES_IAM_CREDENTIAL_SECRET=<your_aws_ses_secret_key>
AWS_SES_IAM_ARN=<your_aws_ses_iam_arn>
AWS_SES_REGION=ap-southeast-3
```

**Use Cases:**
- Welcome emails
- Password reset emails
- Email verification
- Notification emails

**No-Op Mode:**

If any of these is not set, the SES integration runs in no-op mode (disabled, logs a warning on startup, email operations return safe defaults instead of failing):

- `AWS_SES_IAM_CREDENTIAL_KEY`
- `AWS_SES_IAM_CREDENTIAL_SECRET`
- `AWS_SES_REGION`

Templates, the sync command, and send flow: [Email Documentation][ref-doc-email]. Queue wiring: [Notification][ref-doc-notification] and [Queue][ref-doc-queue].

## Firebase

[Firebase Admin SDK][ref-firebase] is used for sending push notifications to mobile devices.

**Packages:**
- `firebase-admin`

**Environment Variables:**
```dotenv
FIREBASE_PROJECT_ID=<your_firebase_project_id>
FIREBASE_CLIENT_EMAIL=<your_firebase_client_email>
FIREBASE_PRIVATE_KEY=<your_firebase_private_key>
```

**Features:**
- Push notification delivery via FCM
- Batch send support
- Invalid token detection and cleanup

Leave `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` empty to disable Firebase in development.

For notification details, see [Notification Documentation][ref-doc-notification].

## Sentry

[Sentry][ref-sentry] tracks errors and performance.

**Packages:**
- `@sentry/nestjs`
- `@sentry/profiling-node`

**Environment Variables:**
```dotenv
SENTRY_DSN=<your_sentry_dsn>
```

**Features:**
- Automatic error tracking through `SentryService` (`src/common/sentry`), used by the exception filters and `QueueProcessorBase`
- Performance monitoring and profiling
- Queue job failure tracking (integrated in `QueueProcessorBase`)
- Request context capture, scrubbed in `src/instrument.ts` before it leaves the process (URLs masked, sensitive headers, cookies, and body fields redacted). See [Logger][ref-doc-logger]

Leave `SENTRY_DSN` empty to disable Sentry in development.

## Redis

[Redis][ref-redis] is the cache store and the queue backend.

**Packages:**
- `@keyv/redis`
- `keyv`
- `bullmq`
- `cache-manager`

**Environment Variables:**
```dotenv
CACHE_REDIS_URL=redis://localhost:6379/0
QUEUE_REDIS_URL=redis://localhost:6379/1
```

**Use Cases:**
- Application caching (DB 0)
- Background job queues (DB 1)
- Rate limiting data

For cache implementation, see [Cache][ref-doc-cache]. For queue details, see [Queue][ref-doc-queue].

## PostgreSQL

[PostgreSQL][ref-postgresql] with [Prisma][ref-prisma] as the primary database.

**Packages:**
- `@prisma/client` (runtime of the generated client)
- `prisma` (CLI and the `prisma-client` generator, which writes the client into `src/generated/prisma-client`)

**Environment Variables:**
```dotenv
DATABASE_URL=postgresql://ack:ack_password@localhost:5432/ACKNestJs?schema=public
DATABASE_DEBUG=true
```

**Features:**
- Transaction support
- Relational constraints and indexes
- UUIDv7 primary keys
- Type-safe queries via Prisma

For database setup and usage, see [Database][ref-doc-database].

## Social Authentication

### Google OAuth

[Google OAuth][ref-google-oauth] for social login integration.

**Packages:**
- `google-auth-library`

**Environment Variables:**
```dotenv
AUTH_SOCIAL_GOOGLE_CLIENT_ID=<your_google_client_id>
AUTH_SOCIAL_GOOGLE_CLIENT_SECRET=<your_google_client_secret>
```

For authentication flow details, see [Authentication][ref-doc-authentication].

### Apple Sign In

[Apple Sign In][ref-apple-signin] for iOS authentication.

**Packages:**
- `verify-apple-id-token`

**Environment Variables:**
```dotenv
AUTH_SOCIAL_APPLE_CLIENT_ID=<your_apple_client_id>
AUTH_SOCIAL_APPLE_SIGN_IN_CLIENT_ID=<your_apple_sign_in_client_id>
```

For authentication flow details, see [Authentication][ref-doc-authentication].

## HashiCorp Vault

[HashiCorp Vault][ref-vault] is integrated as an **optional** secret store. Rather than connecting to the app at runtime, it acts as the source of truth for local secrets and writes them into `.env` on demand.

**Gated by the `vault` Docker Compose profile**, so it never starts unless you opt in.

**How it differs from the other integrations on this page:**
- It is **not** consumed by the application at runtime; the app still reads `.env`. Vault only *produces* that file.
- It runs with a persistent file backend, auto-unsealed by the container entrypoint, with secrets laid out per environment and read through a per-environment read-only AppRole.

> [!NOTE]
> For the full architecture, KV layout, usage flow, configuration reference, and scope/limitations, see the [Vault Documentation][ref-doc-vault].




<!-- REFERENCES -->

[ref-nestjs-storage]: https://www.npmjs.com/package/@nestjs/storage
[ref-aws-ses]: https://docs.aws.amazon.com/ses/
[ref-firebase]: https://firebase.google.com/docs/admin/setup
[ref-sentry]: https://sentry.io
[ref-redis]: https://redis.io
[ref-postgresql]: https://www.postgresql.org/docs/
[ref-prisma]: https://www.prisma.io
[ref-google-oauth]: https://developers.google.com/identity/protocols/oauth2
[ref-apple-signin]: https://developer.apple.com/sign-in-with-apple/
[ref-vault]: https://developer.hashicorp.com/vault

[ref-doc-configuration]: configuration.md
[ref-doc-environment]: environment.md
[ref-doc-authentication]: authentication.md
[ref-doc-file-upload]: file-upload.md
[ref-doc-email]: email.md
[ref-doc-queue]: queue.md
[ref-doc-cache]: cache.md
[ref-doc-database]: database.md
[ref-doc-notification]: notification.md
[ref-doc-vault]: vault.md
[ref-doc-logger]: logger.md
[ref-doc-status-codes]: status-codes.md
