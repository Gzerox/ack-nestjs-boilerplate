# Environment Documentation

Environment variables are listed in `.env.example`.

## Overview

Runtime config is environment variables. `AppEnvSchema` validates them at startup. Docker Compose is the recommended way to run PostgreSQL and Redis locally; see [Installation][ref-doc-installation].

## Related Documents

- [Configuration Documentation][ref-doc-configuration] - How env vars map into `registerAs` configs
- [Installation Documentation][ref-doc-installation] - Creating `.env` (Docker recommended)
- [Database Documentation][ref-doc-database] - PostgreSQL connection and Prisma migrations
- [Authentication Documentation][ref-doc-authentication] - JWT and OAuth
- [Vault Documentation][ref-doc-vault] - Optional secret sync into `.env`
- [Email Documentation][ref-doc-email] - SES templates
- [Storage Documentation][ref-doc-storage] - Object storage, signed uploads, bucket setup

## Table of Contents

- [Overview](#overview)
- [Related Documents](#related-documents)
- [Environment Validation](#environment-validation)
- [Example Configuration](#example-configuration)
- [Environment Variables](#environment-variables)
  - [Application Settings](#application-settings)
  - [Home/Organization Settings](#homeorganization-settings)
  - [HTTP Server Settings](#http-server-settings)
  - [Logging Settings](#logging-settings)
  - [CORS Settings](#cors-settings)
  - [URL Versioning Settings](#url-versioning-settings)
  - [Database Settings](#database-settings)
  - [Authentication Settings](#authentication-settings)
  - [Social Authentication Settings](#social-authentication-settings)
  - [Two-Factor Authentication Settings](#two-factor-authentication-settings)
  - [Storage Settings](#storage-settings)
  - [AWS Settings](#aws-settings)
  - [Email Settings](#email-settings)
  - [Firebase Settings](#firebase-settings)
  - [Redis Settings](#redis-settings)
  - [Debug Settings](#debug-settings)

## Environment Validation

`process.env` is validated against a zod schema handed to `ConfigModule.forRoot()` in `src/common/common.module.ts`, so the check runs while the module graph is being built, before any provider resolves a config value:

```typescript
ConfigModule.forRoot({
    load: configs,
    isGlobal: true,
    cache: true,
    envFilePath: ['.env', `.env.${process.env.NODE_ENV ?? 'local'}`],
    expandVariables: false,
    validationSchema: AppEnvSchema,
}),
```

`AppEnvSchema` is located at `src/app/dtos/app.env.dto.ts`. Field shapes:

- An env boolean is `RequestBooleanStringSchema` (a case-sensitive `z.stringbool` accepting exactly `'true'` or `'false'`)
- An encryption secret is `RequestEncryptionSecretSchema` (exactly 64 base64url characters)
- A port is `z.coerce.number().int()`
- An enum-valued variable is `z.enum` over the matching `Enum*`, so a typo is caught by name rather than surfacing later as a runtime error

If validation fails, the application does not start and reports which environment variables are missing or invalid. The error reaches the `bootstrap().catch()` handler in `src/main.ts`, which writes the stack to `stderr` and calls `process.exit(1)`.

## Example Configuration

Below is an example `.env` file based on the current `.env.example`:

> [!WARNING]
> **Security**: All secret and key values below (`*_ENCRYPTION_SECRET_KEY`, `*_ENCRYPTION_KEY`, `AUTH_JWT_*_KEY`) are placeholders for illustration only. They are empty in `.env.example`, so startup validation fails until they are set. `pnpm generate:secret` generates a unique set: the JWT keys and KIDs under `keys/`, and both encryption secrets in `keys/encryption-secret.env`. With `--direct-insert` it also writes them into `.env`. `STORAGE_LOCAL_SIGNING_KEYS` is empty in `.env.example` too; `pnpm generate:secret` (or `pnpm generate:secret:storage`) writes it to `keys/storage-secret.env`, and into `.env` with `--direct-insert`. See [Installation][ref-doc-installation].

```bash
# Application Settings
APP_NAME=ACKNestJs
APP_ENV=local
APP_LANGUAGE=en
APP_TIMEZONE=Asia/Jakarta
APP_ENCRYPTION_SECRET_KEY=<your_app_encryption_secret_key>

# Home/Organization
HOME_URL=https://example.com
HOME_NAME=ACKNestJs

# HTTP Server
HTTP_HOST=localhost
HTTP_PORT=3000
HTTP_TRUSTED_PROXY=

# Logging
LOGGER_ENABLE=true
LOGGER_LEVEL=debug
LOGGER_INTO_FILE=true
LOGGER_PRETTIER=true
LOGGER_AUTO=false

# CORS
CORS_ALLOWED_ORIGIN=*

# URL Versioning
URL_VERSIONING_ENABLE=true
URL_VERSION=1

# Database (Compose locally; managed PostgreSQL without Docker)
DATABASE_URL=postgresql://ack:ack_password@localhost:5432/ACKNestJs?schema=public
DATABASE_DEBUG=true

# JWT Authentication
AUTH_JWT_ISSUER=https://example.com
AUTH_JWT_AUDIENCE=ACKNestJs

# Access Token Configuration
AUTH_JWT_ACCESS_TOKEN_JWKS_URI=http://localhost:3011/.well-known/access-jwks.json
AUTH_JWT_ACCESS_TOKEN_KID=<your_jwt_access_token_kid>
AUTH_JWT_ACCESS_TOKEN_PRIVATE_KEY=<your_jwt_access_token_private_key>
AUTH_JWT_ACCESS_TOKEN_PUBLIC_KEY=<your_jwt_access_token_public_key>
AUTH_JWT_ACCESS_TOKEN_EXPIRED=1h

# Refresh Token Configuration
AUTH_JWT_REFRESH_TOKEN_JWKS_URI=http://localhost:3011/.well-known/refresh-jwks.json
AUTH_JWT_REFRESH_TOKEN_KID=<your_jwt_refresh_token_kid>
AUTH_JWT_REFRESH_TOKEN_PRIVATE_KEY=<your_jwt_refresh_token_private_key>
AUTH_JWT_REFRESH_TOKEN_PUBLIC_KEY=<your_jwt_refresh_token_public_key>
AUTH_JWT_REFRESH_TOKEN_EXPIRED=30d

# Two-Factor Authentication
AUTH_TWO_FACTOR_ISSUER=
AUTH_TWO_FACTOR_ENCRYPTION_KEY=<your_two_factor_encryption_key>

# Social Authentication (Optional)
AUTH_SOCIAL_GOOGLE_CLIENT_ID=
AUTH_SOCIAL_GOOGLE_CLIENT_SECRET=
AUTH_SOCIAL_APPLE_CLIENT_ID=
AUTH_SOCIAL_APPLE_SIGN_IN_CLIENT_ID=

# Object Storage (local driver by default)
STORAGE_DRIVER=local
STORAGE_PUBLIC_BASE_URL=http://localhost:3000
STORAGE_LOCAL_ROOT=./storage-data
STORAGE_LOCAL_SIGNING_KEYS=
STORAGE_S3_ENDPOINT=
STORAGE_S3_REGION=
STORAGE_S3_ACCESS_KEY_ID=
STORAGE_S3_SECRET_ACCESS_KEY=
STORAGE_S3_FORCE_PATH_STYLE=false
STORAGE_S3_PUBLIC_BUCKET=
STORAGE_S3_PRIVATE_BUCKET=

# AWS SES Configuration (Optional)
AWS_SES_IAM_CREDENTIAL_KEY=
AWS_SES_IAM_CREDENTIAL_SECRET=
AWS_SES_IAM_ARN=
AWS_SES_REGION=

# Email
EMAIL_NO_REPLY=noreply@mail.com
EMAIL_SUPPORT=support@mail.com
EMAIL_ADMIN=admin@mail.com

# Firebase (Optional)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Redis
# Redis (Compose locally; ElastiCache without Docker)
CACHE_REDIS_URL=redis://localhost:6379/0
QUEUE_REDIS_URL=redis://localhost:6379/1

# Debug (Optional)
SENTRY_DSN=
```

## Environment Variables

Validated by `AppEnvSchema`. Each variable:

### Application Settings

**`APP_NAME`** *(required)*  
The name of your application. Used throughout the system for identification.
```bash
APP_NAME=ACKNestJs
```

**`APP_ENV`** *(required)*  
The environment the application is running in. Possible values: `development`, `staging`, `production`, `local`
```bash
APP_ENV=local
```

**`APP_LANGUAGE`** *(required)*  
Default language for the application. Validated against `EnumMessageLanguage`; currently only `en` is supported.
```bash
APP_LANGUAGE=en
```

**`APP_TIMEZONE`** *(required)*  
Default timezone for date operations. Validated against `EnumRequestTimezone`; currently only `Asia/Jakarta` is supported.
```bash
APP_TIMEZONE=Asia/Jakarta
```

**`APP_ENCRYPTION_SECRET_KEY`** *(required)*  
Root secret `HelperEncryptionService` derives AES-256-GCM keys from (HKDF-SHA256). It encrypts the sensitive fields of notification job payloads. Exactly 64 base64url characters, the encoding of 48 random bytes (`RequestEncryptionSecretSchema`). Empty by default; startup validation rejects an unset or malformed value. `pnpm generate:secret:encryption` generates a unique value per environment. Rotating it makes queued notification jobs that were encrypted under the old value fail to decrypt.
```bash
APP_ENCRYPTION_SECRET_KEY=<your_app_encryption_secret_key>
```

**`NODE_ENV`** *(optional)*  
Selects the second env file loaded by `ConfigModule.forRoot` in `src/common/common.module.ts`: `.env` is always read, then `.env.${NODE_ENV}`, falling back to `.env.local` when unset. It is not part of `AppEnvSchema`, and `src/main.ts` overwrites it with `app.env` once the config is loaded.
```bash
NODE_ENV=local
```

### Home/Organization Settings

**`HOME_NAME`** *(required)*  
Display name for your organization/home page.
```bash
HOME_NAME=ACKNestJs
```

**`HOME_URL`** *(required)*  
URL for your home/landing page.
```bash
HOME_URL=https://example.com
```

### HTTP Server Settings

**`HTTP_HOST`** *(required)*  
Address to bind the HTTP server to. Accepts a hostname such as `localhost` or an IPv4 literal like `0.0.0.0` or `127.0.0.1`.
```bash
HTTP_HOST=localhost
```

**`HTTP_PORT`** *(required)*  
Port number for the HTTP server.
```bash
HTTP_PORT=3000
```

**`HTTP_TRUSTED_PROXY`** *(optional)*  
Comma-separated list of proxy NETWORKS whose forwarding headers Express may trust, passed straight to `trust proxy`. Accepts the `proxy-addr` preset names (`loopback`, `linklocal`, `uniquelocal`) and explicit CIDRs. It is never a hop count and never `true`.

Empty trusts no proxy: `req.ip` is then the direct socket peer and a client cannot forge it through `X-Forwarded-For`. Behind a CDN or edge proxy that connects from a public address, a value without that provider's CIDRs puts every client behind it in one rate-limit bucket.
```bash
# no proxy trusted
HTTP_TRUSTED_PROXY=

# private-network proxies
HTTP_TRUSTED_PROXY=loopback,uniquelocal

# an edge provider on public addresses
HTTP_TRUSTED_PROXY=173.245.48.0/20,103.21.244.0/22
```

### Logging Settings

**`LOGGER_ENABLE`** *(required)*  
Enable or disable application logging.
```bash
LOGGER_ENABLE=true
```

**`LOGGER_LEVEL`** *(required)*  
Minimum log level. Validated against `EnumLoggerLevel`, which declares Pino's own level set. Options: `fatal`, `error`, `warn`, `info`, `debug`, `trace`
```bash
LOGGER_LEVEL=debug
```

**`LOGGER_INTO_FILE`** *(required)*  
Whether to write logs to files.
```bash
LOGGER_INTO_FILE=true
```

**`LOGGER_PRETTIER`** *(required)*  
Whether to format logs in a prettier, readable way.
```bash
LOGGER_PRETTIER=true
```

**`LOGGER_AUTO`** *(required)*  
Enable automatic logging features.
```bash
LOGGER_AUTO=false
```

### CORS Settings

**`CORS_ALLOWED_ORIGIN`** *(required)*  
Comma-separated list of allowed CORS origins. Supports subdomain wildcards and explicit ports, but not port wildcards.

**Syntax:**
- `*` — Allow all origins (credentials disabled)
- `hostname` — Single origin (e.g., `example.com`)
- `*.subdomain` — Wildcard subdomains (e.g., `*.example.com` matches `api.example.com` and `example.com`)
- `hostname:port` — Specific hostname with port (e.g., `api.example.com:3000`)
- `*.subdomain:port` — Wildcard with explicit port (e.g., `*.example.com:3000`)

**Examples:**
```bash
# Allow all origins (development only); credentials NOT allowed
CORS_ALLOWED_ORIGIN=*

# Specific origins
CORS_ALLOWED_ORIGIN=example.com,app.example.com

# Subdomain wildcard (matches api.example.com and example.com)
CORS_ALLOWED_ORIGIN=*.example.com,api.myapp.com

# Multiple domains with explicit ports
CORS_ALLOWED_ORIGIN=*.example.com:3000,api.myapp.com:8080,localhost:3000

# Mixed; wildcards and specific ports
CORS_ALLOWED_ORIGIN=*.example.com,api.production.com:443,localhost:3000
```

**Port Matching Behavior:**
```bash
# ✅ SUPPORTED; Exact port matching
CORS_ALLOWED_ORIGIN=api.example.com:3000  # Matches: http://api.example.com:3000, https://api.example.com:3000

# ❌ NOT SUPPORTED; Port wildcards
CORS_ALLOWED_ORIGIN=api.example.com:*     # Does NOT work

# ✅ SUPPORTED; Default port (implicit)
CORS_ALLOWED_ORIGIN=api.example.com       # Matches: http://api.example.com, https://api.example.com (no explicit port)
```

**Protocol Behavior:**
- Both `http` and `https` are automatically allowed for the same origin
- Protocol is **not** part of the pattern (no need to specify `https://` in the pattern)

**Credentials Behavior:**
- **Wildcard (`*`)**: Credentials are **disabled** (CORS security restriction)
- **Specific origins**: Credentials are **enabled**

> [!TIP]
> Production: name explicit origins. A wildcard with credentials off is for development.

### URL Versioning Settings

**`URL_VERSIONING_ENABLE`** *(required)*  
Enable URL versioning for your API (e.g., `/api/v1/shared/user/profile/get`).
```bash
URL_VERSIONING_ENABLE=true
```

**`URL_VERSION`** *(required)*  
Default API version number.
```bash
URL_VERSION=1
```

### Database Settings

**`DATABASE_URL`** *(required)*  
PostgreSQL connection string. Docker Compose is the recommended local path; without Docker point it at a managed PostgreSQL instance. Setup: [Installation][ref-doc-installation].
```bash
# Local Compose (recommended)
DATABASE_URL=postgresql://ack:ack_password@localhost:5432/ACKNestJs?schema=public

# Managed PostgreSQL instance
# DATABASE_URL=postgresql://username:password@host:5432/ACKNestJs?schema=public
```

**`DATABASE_DEBUG`** *(required)*  
Log Prisma queries when `true`.
```bash
DATABASE_DEBUG=true
```

### Authentication Settings

**`AUTH_JWT_ISSUER`** *(required)*  
JWT issuer claim value (usually your domain).
```bash
AUTH_JWT_ISSUER=https://example.com
```

**`AUTH_JWT_AUDIENCE`** *(required)*  
JWT audience claim value (usually your application name).
```bash
AUTH_JWT_AUDIENCE=ACKNestJs
```

#### Access Token Settings

**`AUTH_JWT_ACCESS_TOKEN_JWKS_URI`** *(required)*  
Public URI where access token JWKS is hosted.
```bash
AUTH_JWT_ACCESS_TOKEN_JWKS_URI=http://localhost:3011/.well-known/access-jwks.json
```

**`AUTH_JWT_ACCESS_TOKEN_KID`** *(required)*  
Key ID for access token. `pnpm generate:secret:jwt` prints it and, with `--direct-insert`, writes it into `.env`.
```bash
AUTH_JWT_ACCESS_TOKEN_KID=<your_jwt_access_token_kid>
```

**`AUTH_JWT_ACCESS_TOKEN_PRIVATE_KEY`** *(required)*  
Private key content for signing access tokens.
```bash
AUTH_JWT_ACCESS_TOKEN_PRIVATE_KEY=<your_jwt_access_token_private_key>
```

**`AUTH_JWT_ACCESS_TOKEN_PUBLIC_KEY`** *(required)*  
Public key content for verifying access tokens.
```bash
AUTH_JWT_ACCESS_TOKEN_PUBLIC_KEY=<your_jwt_access_token_public_key>
```

**`AUTH_JWT_ACCESS_TOKEN_EXPIRED`** *(required)*  
Access token expiration time. Format: `1h`, `30m`, `2d`
```bash
AUTH_JWT_ACCESS_TOKEN_EXPIRED=1h
```

#### Refresh Token Settings

**`AUTH_JWT_REFRESH_TOKEN_JWKS_URI`** *(required)*  
Public URI where refresh token JWKS is hosted.
```bash
AUTH_JWT_REFRESH_TOKEN_JWKS_URI=http://localhost:3011/.well-known/refresh-jwks.json
```

**`AUTH_JWT_REFRESH_TOKEN_KID`** *(required)*  
Key ID for refresh token. `pnpm generate:secret:jwt` prints it and, with `--direct-insert`, writes it into `.env`.
```bash
AUTH_JWT_REFRESH_TOKEN_KID=<your_jwt_refresh_token_kid>
```

**`AUTH_JWT_REFRESH_TOKEN_PRIVATE_KEY`** *(required)*  
Private key content for signing refresh tokens.
```bash
AUTH_JWT_REFRESH_TOKEN_PRIVATE_KEY=<your_jwt_refresh_token_private_key>
```

**`AUTH_JWT_REFRESH_TOKEN_PUBLIC_KEY`** *(required)*  
Public key content for verifying refresh tokens.
```bash
AUTH_JWT_REFRESH_TOKEN_PUBLIC_KEY=<your_jwt_refresh_token_public_key>
```

**`AUTH_JWT_REFRESH_TOKEN_EXPIRED`** *(required)*  
Refresh token expiration time. Format: `7d`, `30d`, `90d`
```bash
AUTH_JWT_REFRESH_TOKEN_EXPIRED=30d
```

### Social Authentication Settings

> [!NOTE]
> All social authentication settings are optional. Leave empty if not using social login.

**`AUTH_SOCIAL_GOOGLE_CLIENT_ID`** *(optional)*  
Google OAuth client ID.
```bash
AUTH_SOCIAL_GOOGLE_CLIENT_ID=
```

**`AUTH_SOCIAL_GOOGLE_CLIENT_SECRET`** *(optional)*  
Google OAuth client secret.
```bash
AUTH_SOCIAL_GOOGLE_CLIENT_SECRET=
```

**`AUTH_SOCIAL_APPLE_CLIENT_ID`** *(optional)*  
Apple OAuth client ID.
```bash
AUTH_SOCIAL_APPLE_CLIENT_ID=
```

**`AUTH_SOCIAL_APPLE_SIGN_IN_CLIENT_ID`** *(optional)*  
Apple Sign In client ID.
```bash
AUTH_SOCIAL_APPLE_SIGN_IN_CLIENT_ID=
```

### Two-Factor Authentication Settings

**`AUTH_TWO_FACTOR_ISSUER`** *(required)*  
Issuer name displayed in authenticator apps. Empty by default; startup validation rejects an unset value.  
```bash
AUTH_TWO_FACTOR_ISSUER=ACKNestJsTwoFactor
```

**`AUTH_TWO_FACTOR_ENCRYPTION_KEY`** *(required)*  
Root secret `HelperEncryptionService` derives the AES-256-GCM keys for stored TOTP secrets from. Exactly 64 base64url characters, the encoding of 48 random bytes (`RequestEncryptionSecretSchema`). Empty by default; startup validation rejects an unset or malformed value. `pnpm generate:secret:encryption` generates a unique value per environment. Rotating it leaves every stored TOTP secret undecryptable, and an authenticator code check then returns `409 twoFactorSecretUnavailable` (see [Two-Factor][ref-doc-two-factor]).  
```bash
AUTH_TWO_FACTOR_ENCRYPTION_KEY=<your_two_factor_encryption_key>
```

### Storage Settings

`STORAGE_DRIVER` picks the implementation behind the two named disks, `public` and `private`. Either driver runs in any environment. Startup validation checks only the variables of the selected driver and fails when one of them is missing. Behaviour and bucket setup: [Storage Documentation][ref-doc-storage].

**`STORAGE_DRIVER`** *(optional, default `local`)*  
`local` keeps objects on the API host's filesystem and serves them through the API. `s3` uses AWS S3 or an S3-compatible provider such as Cloudflare R2.
```bash
STORAGE_DRIVER=local
```

**`STORAGE_PUBLIC_BASE_URL`** *(required)*  
An `http` or `https` URL. Under `local`, the API origin: public URLs become `<base>/api/storage/public/<key>` and signed URLs `<base>/api/storage/private?...`. Under `s3`, the public base URL of the public bucket (a CDN or custom domain in front of it, or the bucket endpoint); a public URL is this base plus the object key.
```bash
STORAGE_PUBLIC_BASE_URL=http://localhost:3000
```

#### Local Driver

**`STORAGE_LOCAL_ROOT`** *(required when `STORAGE_DRIVER=local`)*  
Directory holding both disks: `<root>/public` and `<root>/private`. The directories are created at startup. `./storage-data` is gitignored, and `docker-compose.yml` mounts it into the API container.
```bash
STORAGE_LOCAL_ROOT=./storage-data
```

**`STORAGE_LOCAL_SIGNING_KEYS`** *(required when `STORAGE_DRIVER=local`)*  
Comma-separated HMAC keys for the signed private URLs, each at least 32 characters. The first key signs and every key verifies. `pnpm generate:secret:storage --direct-insert` writes one fresh key and replaces the whole list, which stops every URL signed with the old key from verifying. A rotation that keeps issued URLs valid puts the new key (from `keys/storage-secret.env`) first by hand and drops the old one once the URLs it signed have expired (10 minutes at most).
```bash
STORAGE_LOCAL_SIGNING_KEYS=<new_key>,<previous_key>
```

#### S3 Driver

**`STORAGE_S3_ENDPOINT`** *(optional)*  
An `http` or `https` URL of an S3-compatible service. Empty uses the AWS regional endpoint. Cloudflare R2: `https://<account_id>.r2.cloudflarestorage.com`.
```bash
STORAGE_S3_ENDPOINT=
```

**`STORAGE_S3_REGION`** *(required when `STORAGE_DRIVER=s3`)*  
AWS region of the buckets. Validation requires `auto` when the endpoint host ends in `.r2.cloudflarestorage.com`.
```bash
STORAGE_S3_REGION=
```

**`STORAGE_S3_ACCESS_KEY_ID`** / **`STORAGE_S3_SECRET_ACCESS_KEY`** *(required when `STORAGE_DRIVER=s3`)*  
Credentials of the storage identity (an IAM user, or an R2 API token). The same pair serves both buckets.
```bash
STORAGE_S3_ACCESS_KEY_ID=
STORAGE_S3_SECRET_ACCESS_KEY=
```

**`STORAGE_S3_FORCE_PATH_STYLE`** *(optional, default `false`)*  
`true` addresses `https://endpoint/bucket/key` rather than `https://bucket.endpoint/key`. MinIO and most self-hosted stores need it.
```bash
STORAGE_S3_FORCE_PATH_STYLE=false
```

**`STORAGE_S3_PUBLIC_BUCKET`** *(required when `STORAGE_DRIVER=s3`)*  
Bucket behind the `public` disk: every uploaded asset, delivered without authentication, such as profile photos and term policy content. Signed direct uploads land here at their final key.
```bash
STORAGE_S3_PUBLIC_BUCKET=
```

**`STORAGE_S3_PRIVATE_BUCKET`** *(required when `STORAGE_DRIVER=s3`)*  
Bucket behind the `private` disk: protected documents delivered only through signed downloads. No feature stores to it today. It blocks all public access.
```bash
STORAGE_S3_PRIVATE_BUCKET=
```

### AWS Settings

> [!NOTE]
> AWS settings cover SES only and are optional. Email delivery needs them.

#### SES (Email Service)

**`AWS_SES_IAM_CREDENTIAL_KEY`** *(optional/required for email features)*  
AWS IAM access key ID for SES email service.
```bash
AWS_SES_IAM_CREDENTIAL_KEY=
```

**`AWS_SES_IAM_CREDENTIAL_SECRET`** *(optional/required for email features)*  
AWS IAM secret access key for SES email service.
```bash
AWS_SES_IAM_CREDENTIAL_SECRET=
```

**`AWS_SES_IAM_ARN`** *(required when SES credentials are set)*  
AWS IAM Role ARN for SES operations. Used for role-based access control and temporary credentials. Validation requires it whenever `AWS_SES_IAM_CREDENTIAL_KEY` or `AWS_SES_IAM_CREDENTIAL_SECRET` is provided.
```bash
AWS_SES_IAM_ARN=
```

> [!TIP]
> Prefer `AWS_SES_IAM_ARN` in production over long-lived keys. Role assumption issues temporary credentials and rotates them.

**`AWS_SES_REGION`** *(optional/required for email features)*  
AWS region for SES service.
```bash
AWS_SES_REGION=
```

### Email Settings

> [!NOTE]
> Email settings are optional.

**`EMAIL_NO_REPLY`** *(optional/required for email features)*  
Sender email address used for no-reply emails (e.g., transactional, notifications).
```bash
EMAIL_NO_REPLY=noreply@mail.com
```

**`EMAIL_SUPPORT`** *(optional/required for email features)*  
Support email address shown in email templates.
```bash
EMAIL_SUPPORT=support@mail.com
```

**`EMAIL_ADMIN`** *(optional/required for email features)*  
Admin email address for internal notifications.
```bash
EMAIL_ADMIN=admin@mail.com
```

### Firebase Settings

> [!NOTE]
> Firebase settings are optional. Required only if push notification features are enabled.

**`FIREBASE_PROJECT_ID`** *(optional/required for push notifications)*  
Firebase project ID from your Firebase console.
```bash
FIREBASE_PROJECT_ID=
```

**`FIREBASE_CLIENT_EMAIL`** *(optional/required for push notifications)*  
Firebase service account client email.
```bash
FIREBASE_CLIENT_EMAIL=
```

**`FIREBASE_PRIVATE_KEY`** *(optional/required for push notifications)*  
Firebase service account private key, accepted either as the PEM block with its newlines written as `\n`, or as the bare base64 PKCS#8 DER body. `FirebaseUtil.normalizePrivateKey` in `src/common/firebase/utils/firebase.util.ts` turns either form into the PEM the Admin SDK expects.
```bash
FIREBASE_PRIVATE_KEY=
```

### Redis Settings

**`CACHE_REDIS_URL`** *(required)*  
Redis URL for cache (`db:0`). Prefer Compose Redis locally; without Docker use a hosted Redis such as [Amazon ElastiCache][ref-elasticache]. Setup: [Installation][ref-doc-installation].
```bash
# Local Compose
CACHE_REDIS_URL=redis://localhost:6379/0
```

**`QUEUE_REDIS_URL`** *(required)*  
Redis URL for BullMQ (`db:1`). Same host as cache is fine; keep a different logical DB when you can.
```bash
# Local Compose
QUEUE_REDIS_URL=redis://localhost:6379/1
```

### Debug Settings

**`SENTRY_DSN`** *(optional)*  
Sentry DSN for error tracking and monitoring.
```bash
SENTRY_DSN=
```



<!-- REFERENCES -->

[ref-doc-configuration]: configuration.md
[ref-doc-installation]: installation.md
[ref-doc-database]: database.md
[ref-doc-authentication]: authentication.md
[ref-doc-two-factor]: two-factor.md
[ref-doc-vault]: vault.md
[ref-doc-email]: email.md
[ref-doc-storage]: storage.md
[ref-elasticache]: https://aws.amazon.com/elasticache/
