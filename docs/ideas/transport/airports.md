---
title: Airports Data Notes
aliases:
  - Flight Setup/Airports
status: developing
stage: implementation
feature_id: flight-setup
owner: backend
last_reviewed: 2026-03-31
source_of_truth: Product/Features/flight-setup/Feature Overview.md
ai_ready: true
note_type: data-note

---

### Prisma Schema

```typescript
enum AirportStatus {
  active
  inactive
}

model Airport {
  id               String        @id @default(auto()) @map("_id") @db.ObjectId

  /// IATA airport code (3 letters), e.g. MXP
  iataCode         String        @unique

  /// ICAO airport code (4 letters), e.g. LIMC
  icaoCode         String        @unique

  /// Full airport name, e.g. Milan Malpensa Airport
  name             String

  /// Short display name, e.g. Malpensa
  shortName        String?

  /// Main city associated with the airport
  city             String

  /// Country name, e.g. Italy
  country          String

  /// ISO country code, e.g. IT
  countryCode      String

  /// Continent display label, e.g. Europe
  continent        String

  /// 2-letter continent code, e.g. EU (project-controlled set: AF, AN, AS, EU, NA, OC, SA)
  continentCode    String?

  /// Region / state / province display label, e.g. Lombardy
  region           String?

  /// ISO 3166-2 subdivision code, e.g. IT-25
  regionCode       String?

  /// IANA timezone, e.g. Europe/Rome
  timezone         String

  /// Currency used in the country/area, e.g. EUR
  currencyCode     String?

  /// Operational status of the airport in the platform
  status           AirportStatus @default(active)

  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  @@index([city])
  @@index([countryCode])
  @@index([continentCode])
  @@index([continent])
  @@index([regionCode])
  @@index([status])
  @@map("airports")
}
```

### Example

```json
{
  "_id": "67cb5c1d8f9b8f2c12345678",
  "iataCode": "MXP",
  "icaoCode": "LIMC",
  "name": "Milan Malpensa Airport",
  "shortName": "Malpensa",
  "city": "Milan",
  "country": "Italy",
  "countryCode": "IT",
  "continent": "Europe",
  "continentCode": "EU",
  "region": "Lombardy",
  "regionCode": "IT-25",
  "timezone": "Europe/Rome",
  "currencyCode": "EUR",
  "status": "active",
  "createdAt": "2026-03-08T12:00:00.000Z",
  "updatedAt": "2026-03-08T12:00:00.000Z"
}
```


## Fields

The airport model should prefer standard-backed code fields for machine logic and keep human-readable labels as display-only values.

| Field | Standard | Required | Validation / guidance |
|---|---|---|---|
| `iataCode` | IATA airport location code | yes | Must match `^[A-Z]{3}$` |
| `icaoCode` | ICAO location indicator | yes | Must match `^[A-Z]{4}$` |
| `countryCode` | ISO 3166-1 alpha-2 | yes | Prefer `@IsISO31661Alpha2()` and uppercase normalization |
| `currencyCode` | ISO 4217 | no | Prefer `@IsISO4217CurrencyCode()` and uppercase normalization |
| `regionCode` | ISO 3166-2 subdivision code | recommended | Useful for machine filtering instead of free-text `region` |
| `timezone` | IANA Time Zone Database | yes | Prefer `@IsTimeZone()` |
| `continentCode` | 2-letter continent code | recommended | ISO 3166 does not define continent codes; use a closed uppercase set such as `AF`, `AN`, `AS`, `EU`, `NA`, `OC`, `SA` |

### Display vs machine fields
- `country`, `continent`, and `region` should be treated as display labels.
- Filtering, joins, imports, and external integrations should prefer `countryCode`, `continentCode`, `regionCode`, `currencyCode`, `iataCode`, and `icaoCode`.
- If both a label and code are stored, the code should be the canonical value and the label should be derivable or refreshable from reference data.

### Validation rules
- `iataCode` must be exactly 3 uppercase letters.
- `icaoCode` must be exactly 4 uppercase letters.
- `countryCode` must be a valid ISO 3166-1 alpha-2 code.
- `currencyCode`, when present, must be a valid ISO 4217 code.
- `regionCode`, when present, should follow ISO 3166-2 for the selected country.
- `continentCode`, when present, must use the project-controlled 2-letter uppercase set consistently across all airport records.
- Invalid or missing required standardized values must be rejected on create/update.

## **Notes**
- iataCode should be the main business identifier used in UI and integrations.
- icaoCode is required and must follow ICAO format (`^[A-Z]{4}$`).
- countryCode should be treated as ISO 3166-1 alpha-2, not a free-text country abbreviation.
- region should remain a display field; add `regionCode` if the platform needs stable subdivision-level filtering or analytics.
- continent should remain a display field; `continentCode` should be the canonical machine value.
- continentCode is intentionally not described as an ISO field because ISO 3166 does not define continent alpha-2 codes.
- status allows the platform to keep historical records without deleting airports.    
- currencyCode is not strictly an airport property, but it can be useful for travel-related business logic and UI display.    
- timezone is important for flight/trip scheduling consistency.

## Airport listing filter
- Airport lists should return both `active` and `inactive` records by default.
- Query param: `status=active|inactive|all`
- Default value when omitted: `all`
- Invalid `status` values should be rejected.

## Timezone handling
- `timezone` must always store an IANA timezone identifier.
- When an operator enters a local departure or arrival time, the application should resolve that local datetime against the selected airport timezone and persist the UTC instant on `FlightSegment`.
- Example:
  - airport `MXP` uses `Europe/Rome`
  - airport `JFK` uses `America/New_York`
  - `2026-06-10 08:00` at `MXP` must be converted using `Europe/Rome`, not the agency user's browser timezone
- UI display should use the airport timezone for the specific leg:
  - departure screens use `departAirport.timezone`
  - arrival screens use `arriveAirport.timezone`
- Validation should reject missing or invalid timezone values in airport data because flight scheduling depends on them.

## Additional examples
### Airport used as departure reference
```json
{
  "id": "67cb5c1d8f9b8f2c12345001",
  "iataCode": "MXP",
  "icaoCode": "LIMC",
  "name": "Milan Malpensa Airport",
  "city": "Milan",
  "countryCode": "IT",
  "timezone": "Europe/Rome",
  "status": "active"
}
```

### Airport used as arrival reference
```json
{
  "id": "67cb5c1d8f9b8f2c12345002",
  "iataCode": "JFK",
  "icaoCode": "KJFK",
  "name": "John F. Kennedy International Airport",
  "city": "New York",
  "countryCode": "US",
  "timezone": "America/New_York",
  "status": "active"
}
```


## Implementation

The airport feature lives inside the `transport` module at `src/modules/transport/`.

### Module structure

```
src/modules/transport/
├── transport.module.ts
└── airport/
    ├── constants/airport.list.constant.ts
    ├── controllers/airport.user.controller.ts
    ├── docs/airport.user.doc.ts
    ├── dtos/
    │   └── response/airport.response.dto.ts
    ├── enums/
    │   ├── airport.enum.ts
    │   └── airport.status-code.enum.ts
    ├── interfaces/airport.service.interface.ts
    ├── repositories/airport.repository.ts
    ├── services/airport.service.ts
    └── utils/airport.util.ts
```

### Prisma schema (actual)

The schema in `prisma/schema.prisma` follows the project convention (timestamps include `createdBy`/`updatedBy`, indexes use `fields:` syntax):

```prisma
enum EnumAirportStatus {
  active
  inactive
}

model Airport {
  id           String            @id @default(auto()) @map("_id") @db.ObjectId
  iataCode     String            @unique
  icaoCode     String            @unique
  name         String
  shortName    String?
  city         String
  country      String
  countryCode  String
  continent    String
  continentCode String?
  region       String?
  timezone     String
  currencyCode String?
  status       EnumAirportStatus @default(active)

  createdAt    DateTime          @default(now())
  createdBy    String?           @db.ObjectId
  updatedAt    DateTime          @updatedAt
  updatedBy    String?           @db.ObjectId

  @@index(fields: [city])
  @@index(fields: [countryCode])
  @@index(fields: [continent])
  @@index(fields: [continentCode])
  @@index(fields: [status])
  @@map("airports")
}
```

### Repository (`airport.repository.ts`)

Injects `DatabaseService` and `PaginationService`. Current methods:

| Method | Signature | Notes |
|---|---|---|
| `findWithPaginationOffset` | `(pagination, status?)` | `status` is optional; when omitted all records are returned |
| `findOneById` | `(id: string)` | Returns `Airport \| null` |
| `create` | `(data: Prisma.AirportCreateInput)` | |
| `update` | `(id: string, data: Prisma.AirportUpdateInput)` | |
| `delete` | `(id: string)` | Hard delete |

The `status` param in `findWithPaginationOffset` is a Prisma `in` filter object (`{ status: { in: [...] } }`). When undefined, no status filter is applied, returning both active and inactive records.

### Service (`airport.service.ts`)

Implements `IAirportService`. Injects `AirportRepository` and `AirportUtil`. Current methods:

| Method | Signature | Notes |
|---|---|---|
| `getList` | `(pagination, status?)` | Calls repository, maps result through `AirportUtil.mapList` |

### Controller (`airport.user.controller.ts`)

- **Path**: `GET /user/v1/airport/list`
- **Auth**: API key + JWT access token, role `user`
- **Decorator order** follows project convention: doc → `@ResponsePaging` → `@RoleProtected` → `@UserProtected` → `@AuthJwtAccessProtected` → `@ApiKeyProtected` → `@Get`

Query parameters:

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | 1 | Max 20 |
| `perPage` | number | 20 | Max 100 |
| `search` | string | — | Searches across `iataCode`, `icaoCode`, `name`, `city`, `country`, `countryCode`, `continent`, `continentCode` |
| `orderBy` | string | `createdAt:desc` | |
| `status` | `active \| inactive` | — (all) | Omit to return both; invalid values are rejected |

### Error codes (`airport.status-code.enum.ts`)

| Enum key | Code |
|---|---|
| `notFound` | 6100 |

### i18n keys (`src/languages/en/airport.json`)

```json
{
  "list": "Airport list",
  "error": {
    "notFound": "Airport not found"
  }
}
```

### Router registration

`AirportUserController` and `TransportModule` are registered in `src/router/routes/routes.user.module.ts`.

---

## References
1. https://ourairports.com/data/
