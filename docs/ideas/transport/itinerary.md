---
title: Transport Itinerary & Flight Segments Implementation Spec
aliases:
  - Flight Setup/Itinerary
status: ready-to-implement
stage: implementation
feature_id: flight-setup
owner: backend
last_reviewed: 2026-04-12
source_of_truth: ACK NestJS Boilerplate Architecture + Product Features
ai_ready: true
note_type: implementation-spec
---

## Scope

This specification covers **end-to-end implementation** of `TransportItinerary` and `TransportFlightSegment` in the transport module.

**In scope (Phase 1):**
- `GET /shared/v1/itineraries/:itineraryId` — full detail with segments
- `POST /shared/v1/itineraries` — create itinerary with nested segments (includes timezone conversion and chronology validation)
- Trip module integration — each itinerary is mandatory tied to a Trip via `tripId` (FK)

**Out of scope (deferred):**
- Participant assignment models (`FlightItineraryParticipant`, `FlightSegmentParticipant`)
- User-facing itinerary endpoints (participant ownership required)
- Segment-level CRUD endpoints (edit/delete individual segments after creation)
- List endpoint (itineraries fetched via trip context)

---

## Database Schema (Prisma)

### Enums

```prisma
enum EnumFlightDirection {
  outbound
  return
}
```

### Models

```prisma
model TransportItinerary {
  id        String               @id @default(auto()) @map("_id") @db.ObjectId
  tripId    String               @db.ObjectId
  name      String               @db.String
  direction EnumFlightDirection

  segments  TransportFlightSegment[]
  trip      Trip                 @relation(fields: [tripId], references: [id], onDelete: Restrict)

  createdAt DateTime             @default(now())
  createdBy String?              @db.ObjectId
  updatedAt DateTime             @updatedAt
  updatedBy String?              @db.ObjectId

  @@index(fields: [tripId])
  @@index(fields: [direction])
  @@index(fields: [createdAt])
  @@map("TransportItineraries")
}

model TransportFlightSegment {
  id              String     @id @default(auto()) @map("_id") @db.ObjectId
  itineraryId     String     @db.ObjectId
  airline         String?    @db.String
  flightNumber    String     @db.String
  departAirportId String     @db.ObjectId
  arriveAirportId String     @db.ObjectId
  departAt        DateTime?  /// UTC
  arriveAt        DateTime?  /// UTC
  bookingRef      String?    @db.String
  notes           String?    @db.String

  itinerary     TransportItinerary @relation(fields: [itineraryId], references: [id], onDelete: Cascade)
  departAirport Airport            @relation("TransportFlightSegmentDepart", fields: [departAirportId], references: [id], onDelete: Restrict)
  arriveAirport Airport            @relation("TransportFlightSegmentArrive", fields: [arriveAirportId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  createdBy String?  @db.ObjectId
  updatedAt DateTime @updatedAt
  updatedBy String?  @db.ObjectId

  @@index(fields: [itineraryId])
  @@index(fields: [departAirportId])
  @@index(fields: [arriveAirportId])
  @@index(fields: [departAt])
  @@index(fields: [arriveAt])
  @@map("TransportFlightSegments")
}
```

## Field Validation Rules

### TransportItinerary

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `tripId` | `string` | Valid ObjectId, required | Must reference existing `Trip`; FK |
| `name` | `string` | 1–255 chars, required | Free text label, e.g. "John Doe outbound" |
| `direction` | `EnumFlightDirection` | `outbound` or `return`, required | Enum only; no null |
| `createdBy` | `string` | ObjectId or null | Audit trail; not user-set |
| `updatedBy` | `string` | ObjectId or null | Audit trail; not user-set |

### TransportFlightSegment

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `itineraryId` | `string` | Valid ObjectId, required | Must reference existing `TransportItinerary` |
| `flightNumber` | `string` | 1–20 chars, required | IATA format, e.g. "BA101", "AA2500" |
| `airline` | `string` | 0–100 chars, optional | Airline name or IATA code, e.g. "United" |
| `departAirportId` | `string` | Valid ObjectId, required | Must reference existing `Airport` |
| `arriveAirportId` | `string` | Valid ObjectId, required, ≠ `departAirportId` | Must reference existing `Airport` |
| `departAt` | `Date` | ISO 8601 UTC, optional | Stored as UTC; local input converted via airport timezone |
| `arriveAt` | `Date` | ISO 8601 UTC, optional, ≥ `departAt` | Stored as UTC; validation: `arriveAt >= departAt` |
| `bookingRef` | `string` | 1–30 chars, optional | Booking reference / PNR, e.g. "AB1C2D" |
| `notes` | `string` | 0–500 chars, optional | Free text; layover instructions, etc. |

**Validation Rules:**
- `departAirportId !== arriveAirportId` — reject with `departAirportSameAsArrive`
- `arriveAt >= departAt` (when both provided) — reject with `arriveAtBeforeDepartAt`
- Consecutive segments (ordered by `departAt asc`): if adjacent segments both have times, `next.departAt >= prev.arriveAt` — reject with `segmentChronologyInvalid`
- Unknown ObjectIds → throw `NotFoundException` with `itineraryNotFound` or `airportNotFound`

---

## Business Rules

### Multi-stop routes
Multi-leg flights are modeled as multiple `TransportFlightSegment` rows. Segments are always returned sorted by `departAt asc, createdAt asc` — no explicit `order` field is stored.

Example: `MXP → FCO → JFK`
```
Itinerary "User A outbound"
├── Segment: MXP → FCO  (departAt: 2026-06-15T04:00Z)
└── Segment: FCO → JFK  (departAt: 2026-06-15T08:00Z)
```

Segments where `departAt` is null sort after timed segments (secondary sort by `createdAt asc` ensures stable ordering).

### Timezone handling
- Input times are in the **local timezone of the selected airport**
- Before persisting, convert local → UTC using `Airport.timezone` (IANA format)
- Example: user enters "10:00" at JFK (America/New_York) → convert to UTC based on current DST rules
- Store only UTC in database
- On response, include UTC times; frontend converts back to local using `Airport.timezone`

**Example conversion:**
```typescript
// User inputs: departAt = "2026-06-15 06:00" in MXP (Europe/Rome)
// Airport.timezone = "Europe/Rome"
// Convert to UTC: "2026-06-14T23:00:00Z" (summer time offset)
// Store in DB: departAt = "2026-06-14T23:00:00Z"
```

### Segment chronology validation
1. Single segment: if both `departAt` and `arriveAt` provided, `arriveAt >= departAt`
2. Consecutive segments: after sorting by `departAt asc`, if adjacent segments both have times, `next.departAt >= prev.arriveAt`
3. DST transitions must be handled by timezone-aware libraries (e.g., `date-fns-tz`)
4. Reject invalid chronology — do not silently reorder or coerce

### Airport immutability
- `Airport.onDelete = Restrict` on both segment foreign keys
- Cannot delete an `Airport` that has flight segments referencing it
- Attempting to delete → Prisma throws constraint error → catch and throw `BadRequestException` with `airportHasSegments`

### Authorization boundary (Phase 1)
- Read endpoints are **backoffice-only** (shared route module)
- Require `@UserProtected()` + `@AuthJwtAccessProtected()` + `@ApiKeyProtected()` (no role check)
- Do not expose `GET /user/itineraries` until participant ownership exists

---

## Module Structure

```
src/modules/transport/
├── transport.module.ts                       (update: export itinerary providers)
├── airport/
│   ├── dtos/response/
│   │   └── airport.response.dto.ts           (imported by itinerary)
│   └── ...
└── itinerary/
    ├── constants/
    │   └── itinerary.list.constant.ts
    ├── controllers/
    │   └── itinerary.shared.controller.ts
    ├── docs/
    │   └── itinerary.shared.doc.ts
    ├── dtos/
    │   ├── request/
    │   │   ├── create-itinerary.request.dto.ts
    │   │   └── create-segments.request.dto.ts
    │   └── response/
    │       ├── itinerary.response.dto.ts
    │       └── itinerary-with-segments.response.dto.ts
    ├── enums/
    │   ├── itinerary.enum.ts
    │   └── itinerary-status-code.enum.ts
    ├── exceptions/
    │   └── itinerary.exception.ts
    ├── interfaces/
    │   └── itinerary.service.interface.ts
    ├── repositories/
    │   └── itinerary.repository.ts
    ├── services/
    │   └── itinerary.service.ts
    └── utils/
        └── itinerary.util.ts
```

---

## Enums

### `itinerary.enum.ts`

```typescript
export enum EnumFlightDirection {
  outbound = 'outbound',
  return = 'return',
}
```

### `itinerary-status-code.enum.ts`

```typescript
export enum EnumItineraryStatusCodeError {
  notFound = 6200,
  departAirportSameAsArrive = 6201,
  arriveAtBeforeDepartAt = 6202,
  segmentChronologyInvalid = 6203,
  airportHasSegments = 6204,
  airportNotFound = 6205,
  invalidObjectId = 6206,
}
```

---

## Constants

### `itinerary.list.constant.ts`

```typescript
export const ItineraryDefaultAvailableSearch = ['name'];

export const ItineraryMaxResults = 100;
export const ItineraryDefaultPerPage = 20;
export const ItineraryMaxNameLength = 255;
export const ItineraryMaxSegments = 10; // per itinerary
```

---

## DTOs

### Request DTOs

#### `create-itinerary.request.dto.ts`

```typescript
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { EnumFlightDirection } from '../enums/itinerary.enum';
import { CreateSegmentRequestDto } from './create-segments.request.dto';

export class CreateItineraryRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsEnum(EnumFlightDirection)
  direction: EnumFlightDirection;

  @ArrayMaxSize(10) // ItineraryMaxSegments
  @ArrayMinSize(1)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSegmentRequestDto)
  segments: CreateSegmentRequestDto[];
}
```

#### `create-segments.request.dto.ts`

```typescript
import { IsDateString, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSegmentRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  flightNumber: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  airline?: string;

  @IsMongoId()
  @IsNotEmpty()
  departAirportId: string;

  @IsMongoId()
  @IsNotEmpty()
  arriveAirportId: string;

  @IsDateString()
  @IsOptional()
  departAt?: string; // ISO 8601 string from client (will convert to UTC)

  @IsDateString()
  @IsOptional()
  arriveAt?: string; // ISO 8601 string from client (will convert to UTC)

  @IsString()
  @IsOptional()
  @MaxLength(30)
  bookingRef?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
```

Trip aggregate note:
- Inline itinerary segments used by `TripCreateDraftRequestDto` / `TripUpdateDraftRequestDto` use a trip-specific DTO (`TripItinerarySegmentCreateRequestDto`) where:
  - `departAt` and `arriveAt` are `Date` type
  - both are optional
  - both use `@Type(() => Date)` + `@IsDate()` validation
- The `CreateSegmentRequestDto` contract above remains specific to the standalone transport itinerary endpoint.

### Response DTOs

#### `itinerary.response.dto.ts`

```typescript
import { DatabaseDto } from '@app/common/database/dtos/database.dto';
import { EnumFlightDirection } from '../enums/itinerary.enum';

export class ItineraryResponseDto extends DatabaseDto {
  name: string;
  direction: EnumFlightDirection;
}
```

#### `itinerary-with-segments.response.dto.ts`

```typescript
import { ItineraryResponseDto } from './itinerary.response.dto';
import { AirportResponseDto } from '../../airport/dtos/response/airport.response.dto';

export class SegmentResponseDto {
  id: string;
  itineraryId: string;
  airline: string | null;
  flightNumber: string;
  departAt: Date | null;
  arriveAt: Date | null;
  bookingRef: string | null;
  notes: string | null;
  departAirport: AirportResponseDto;
  arriveAirport: AirportResponseDto;
  createdAt: Date;
  updatedAt: Date;
}

export class ItineraryWithSegmentsResponseDto extends ItineraryResponseDto {
  segments: SegmentResponseDto[];
}
```

---

## Exceptions

### `itinerary.exception.ts`

```typescript
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EnumItineraryStatusCodeError } from '../enums/itinerary-status-code.enum';

export class ItineraryNotFoundException extends NotFoundException {
  constructor(itineraryId: string) {
    super({
      statusCode: EnumItineraryStatusCodeError.notFound,
      message: 'itinerary.error.notFound',
      messageProperties: { id: itineraryId },
      data: { itineraryId },
    });
  }
}

export class AirportNotFoundBadRequestException extends BadRequestException {
  constructor(airportId: string) {
    super({
      statusCode: EnumItineraryStatusCodeError.airportNotFound,
      message: 'itinerary.error.airportNotFound',
      messageProperties: { id: airportId },
      data: { airportId },
    });
  }
}

export class DepartAirportSameAsArriveException extends BadRequestException {
  constructor() {
    super({
      statusCode: EnumItineraryStatusCodeError.departAirportSameAsArrive,
      message: 'itinerary.error.departAirportSameAsArrive',
      data: {},
    });
  }
}

export class ArriveAtBeforeDepartAtException extends BadRequestException {
  constructor() {
    super({
      statusCode: EnumItineraryStatusCodeError.arriveAtBeforeDepartAt,
      message: 'itinerary.error.arriveAtBeforeDepartAt',
      data: {},
    });
  }
}

export class SegmentChronologyException extends BadRequestException {
  constructor(details: string) {
    super({
      statusCode: EnumItineraryStatusCodeError.segmentChronologyInvalid,
      message: 'itinerary.error.segmentChronologyInvalid',
      messageProperties: { details },
      data: { details },
    });
  }
}

export class AirportHasSegmentsException extends BadRequestException {
  constructor(airportId: string) {
    super({
      statusCode: EnumItineraryStatusCodeError.airportHasSegments,
      message: 'itinerary.error.airportHasSegments',
      messageProperties: { id: airportId },
      data: { airportId },
    });
  }
}
```

---

## Repository

### `itinerary.repository.ts`

```typescript
import { DatabaseService } from '@common/database/services/database.service';
import {
  IPaginationIn,
  IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { Injectable } from '@nestjs/common';
import { Prisma, TransportItinerary } from '@generated/prisma-client';

@Injectable()
export class ItineraryRepository {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly paginationService: PaginationService,
  ) {}

  async findWithPaginationOffset(
    {
      where,
      ...params
    }: IPaginationQueryOffsetParams<
      Prisma.TransportItinerarySelect,
      Prisma.TransportItineraryWhereInput
    >,
    direction?: Record<string, IPaginationIn>,
  ): Promise<IResponsePagingReturn<TransportItinerary>> {
    return this.paginationService.offset<
      TransportItinerary,
      Prisma.TransportItinerarySelect,
      Prisma.TransportItineraryWhereInput
    >(this.databaseService.transportItinerary, {
      ...params,
      where: {
        ...where,
        ...direction,
      },
    });
  }

  async findOneById(id: string): Promise<TransportItinerary | null> {
    return this.databaseService.transportItinerary.findUnique({ where: { id } });
  }

  async findOneWithSegments(id: string) {
    return this.databaseService.transportItinerary.findUnique({
      where: { id },
      include: {
        segments: {
          orderBy: [{ departAt: 'asc' }, { createdAt: 'asc' }],
          include: {
            departAirport: true,
            arriveAirport: true,
          },
        },
      },
    });
  }

  async createWithSegments(
    data: Prisma.TransportItineraryCreateInput,
  ) {
    return this.databaseService.transportItinerary.create({
      data,
      include: {
        segments: {
          orderBy: [{ departAt: 'asc' }, { createdAt: 'asc' }],
          include: {
            departAirport: true,
            arriveAirport: true,
          },
        },
      },
    });
  }
}
```

---

## Service Interface

### `itinerary.service.interface.ts`

```typescript
import {
  IPaginationIn,
  IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { Prisma } from '@generated/prisma-client';
import { CreateItineraryRequestDto } from '../dtos/request/create-itinerary.request.dto';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';

export interface IItineraryService {
  getOne(id: string): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>>;

  create(
    dto: CreateItineraryRequestDto,
    createdBy: string,
  ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>>;
}
```

---

## Service

### `itinerary.service.ts`

```typescript
import {
  IPaginationIn,
  IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { AirportRepository } from '@modules/transport/airport/repositories/airport.repository';
import { Injectable } from '@nestjs/common';
import { fromZonedTime } from 'date-fns-tz';
import { Prisma } from '@generated/prisma-client';
import { CreateItineraryRequestDto } from '../dtos/request/create-itinerary.request.dto';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';
import {
  AirportNotFoundBadRequestException,
  ArriveAtBeforeDepartAtException,
  DepartAirportSameAsArriveException,
  ItineraryNotFoundException,
  SegmentChronologyException,
} from '../exceptions/itinerary.exception';
import { IItineraryService } from '../interfaces/itinerary.service.interface';
import { ItineraryRepository } from '../repositories/itinerary.repository';
import { ItineraryUtil } from '../utils/itinerary.util';

@Injectable()
export class ItineraryService implements IItineraryService {
  constructor(
    private readonly itineraryRepository: ItineraryRepository,
    private readonly airportRepository: AirportRepository,
    private readonly itineraryUtil: ItineraryUtil,
  ) {}

  async getListOffset(
    pagination: IPaginationQueryOffsetParams<
      Prisma.TransportItinerarySelect,
      Prisma.TransportItineraryWhereInput
    >,
    direction?: Record<string, IPaginationIn>,
  ): Promise<IResponsePagingReturn<ItineraryResponseDto>> {
    const { data, ...others } = await this.itineraryRepository.findWithPaginationOffset(
      pagination,
      direction,
    );

    return {
      data: this.itineraryUtil.mapList(data),
      ...others,
    };
  }

  async getOne(id: string): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
    const itinerary = await this.itineraryRepository.findOneWithSegments(id);

    if (!itinerary) {
      throw new ItineraryNotFoundException(id);
    }

    return { data: this.itineraryUtil.mapOneWithSegments(itinerary) };
  }

  async create(
    dto: CreateItineraryRequestDto,
    createdBy?: string,
  ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
    // 1. Batch-fetch all unique airports
    const uniqueAirportIds = [
      ...new Set(dto.segments.flatMap((s) => [s.departAirportId, s.arriveAirportId])),
    ];
    const airports = await Promise.all(
      uniqueAirportIds.map((id) => this.airportRepository.findOneById(id)),
    );
    const airportMap = new Map(
      airports.map((a, i) => [uniqueAirportIds[i], a]),
    );

    // 3. Validate all airport IDs exist
    for (const id of uniqueAirportIds) {
      if (!airportMap.get(id)) {
        throw new AirportNotFoundBadRequestException(id);
      }
    }

    // 4. Convert times so we can sort segments chronologically for validation
    // departAt drives display order; segments with null departAt sort last (by createdAt in DB)
    const convertedSegments: Prisma.TransportFlightSegmentCreateWithoutItineraryInput[] = [];

    for (let i = 0; i < dto.segments.length; i++) {
      const seg = dto.segments[i];

      // 5. Depart ≠ arrive
      if (seg.departAirportId === seg.arriveAirportId) {
        throw new DepartAirportSameAsArriveException();
      }

      // 6. Timezone conversion: local → UTC using airport IANA timezone
      const departAirport = airportMap.get(seg.departAirportId)!;
      const arriveAirport = airportMap.get(seg.arriveAirportId)!;

      const departAt = seg.departAt
        ? fromZonedTime(seg.departAt, departAirport.timezone)
        : null;
      const arriveAt = seg.arriveAt
        ? fromZonedTime(seg.arriveAt, arriveAirport.timezone)
        : null;

      // 7. Single-segment chronology: arriveAt >= departAt
      if (departAt && arriveAt && arriveAt < departAt) {
        throw new ArriveAtBeforeDepartAtException();
      }

      convertedSegments.push({
        flightNumber: seg.flightNumber,
        airline: seg.airline ?? null,
        departAirport: { connect: { id: seg.departAirportId } },
        arriveAirport: { connect: { id: seg.arriveAirportId } },
        departAt,
        arriveAt,
        bookingRef: seg.bookingRef ?? null,
        notes: seg.notes ?? null,
        createdBy: createdBy ?? null,
      });
    }

    // 8. Consecutive-segment chronology: sort by departAt, then validate adjacent pairs
    const timedSegments = convertedSegments
      .filter((s) => s.departAt != null)
      .sort((a, b) => (a.departAt as Date).getTime() - (b.departAt as Date).getTime());

    for (let i = 1; i < timedSegments.length; i++) {
      const prev = timedSegments[i - 1];
      const curr = timedSegments[i];
      if (prev.arriveAt && curr.departAt && (curr.departAt as Date) < (prev.arriveAt as Date)) {
        throw new SegmentChronologyException(
          `Segment departing ${(curr.departAt as Date).toISOString()} departs before previous segment arrives`,
        );
      }
    }

    const created = await this.itineraryRepository.createWithSegments({
      name: dto.name,
      direction: dto.direction,
      createdBy: createdBy ?? null,
      segments: { create: convertedSegments },
    });

    return { data: this.itineraryUtil.mapOneWithSegments(created) };
  }
}
```

---

## Utility

### `itinerary.util.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto, SegmentResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';
import { TransportItinerary, TransportFlightSegment } from '@prisma/client';

@Injectable()
export class ItineraryUtil {
  private readonly logger = new Logger(ItineraryUtil.name);

  mapList(data: TransportItinerary[]): ItineraryResponseDto[] {
    return data.map((itinerary) => ({
      id: itinerary.id,
      name: itinerary.name,
      direction: itinerary.direction,
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt,
    }));
  }

  mapOneWithSegments(
    itinerary: TransportItinerary & {
      segments: (TransportFlightSegment & {
        departAirport: any;
        arriveAirport: any;
      })[];
    },
  ): ItineraryWithSegmentsResponseDto {
    return {
      id: itinerary.id,
      name: itinerary.name,
      direction: itinerary.direction,
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt,
      segments: itinerary.segments.map((segment) => this.mapSegment(segment)),
    };
  }

  private mapSegment(segment: TransportFlightSegment & { departAirport: any; arriveAirport: any }): SegmentResponseDto {
    return {
      id: segment.id,
      itineraryId: segment.itineraryId,
      airline: segment.airline || null,
      flightNumber: segment.flightNumber,
      departAt: segment.departAt,
      arriveAt: segment.arriveAt,
      bookingRef: segment.bookingRef || null,
      notes: segment.notes || null,
      departAirport: segment.departAirport,
      arriveAirport: segment.arriveAirport,
      createdAt: segment.createdAt,
      updatedAt: segment.updatedAt,
    };
  }
}
```

---

## Doc Decorators

### `itinerary.shared.doc.ts`

```typescript
import { applyDecorators, MethodDecorator } from '@nestjs/common';
import { Doc } from '@common/doc/decorators/doc.decorator';
import { DocAuth } from '@common/doc/decorators/doc-auth.decorator';
import { DocResponsePaging } from '@common/doc/decorators/doc-response-paging.decorator';
import { DocResponse } from '@common/doc/decorators/doc-response.decorator';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';
import { ItineraryDefaultAvailableSearch } from '../constants/itinerary.list.constant';

export function ItinerarySharedListDoc(): MethodDecorator {
  return applyDecorators(
    Doc({
      summary: 'Get list of itineraries',
      description: 'Retrieve a paginated list of flight itineraries with optional filtering by direction.',
    }),
    DocAuth({ xApiKey: true, jwtAccessToken: true }),
    DocResponsePaging<ItineraryResponseDto>('itinerary.list', {
      dto: ItineraryResponseDto,
      availableSearch: ItineraryDefaultAvailableSearch,
    }),
  );
}

export function ItinerarySharedGetDoc(): MethodDecorator {
  return applyDecorators(
    Doc({
      summary: 'Get itinerary details with segments',
      description: 'Retrieve a complete itinerary record including all flight segments with airport details.',
    }),
    DocAuth({ xApiKey: true, jwtAccessToken: true }),
    DocResponse<ItineraryWithSegmentsResponseDto>('itinerary.get', {
      dto: ItineraryWithSegmentsResponseDto,
    }),
  );
}

export function ItinerarySharedCreateDoc(): MethodDecorator {
  return applyDecorators(
    Doc({
      summary: 'Create an itinerary with segments',
      description: 'Create a flight itinerary with one or more flight segments. Departure/arrival times are accepted in the local airport timezone and stored as UTC.',
    }),
    DocAuth({ xApiKey: true, jwtAccessToken: true }),
    DocResponse<ItineraryWithSegmentsResponseDto>('itinerary.create', {
      dto: ItineraryWithSegmentsResponseDto,
      httpStatus: 201,
    }),
  );
}
```

---

## Controller

### `itinerary.shared.controller.ts`

```typescript
import {
  IPaginationIn,
  IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import {
  PaginationOffsetQuery,
  PaginationQueryFilterInEnum,
} from '@common/pagination/decorators/pagination.decorator';
import { Response, ResponsePaging } from '@common/response/decorators/response.decorator';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { AuthJwtAccessProtected } from '@modules/auth/decorators/auth.jwt.decorator';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@generated/prisma-client';
import { ItinerarySharedCreateDoc, ItinerarySharedGetDoc, ItinerarySharedListDoc } from '../docs/itinerary.shared.doc';
import { CreateItineraryRequestDto } from '../dtos/request/create-itinerary.request.dto';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';
import { EnumFlightDirection } from '../enums/itinerary.enum';
import { ItineraryDefaultAvailableSearch } from '../constants/itinerary.list.constant';
import { ItineraryService } from '../services/itinerary.service';

// Resolved URLs (registered in routes.shared.module.ts with /shared prefix):
// GET  /shared/v1/itineraries
// GET  /shared/v1/itineraries/:itineraryId
// POST /shared/v1/itineraries

@ApiTags('modules.shared.itinerary')
@Controller({
  path: 'itineraries',
  version: '1',
})
export class ItinerarySharedController {
  constructor(private readonly itineraryService: ItineraryService) {}

  @ItinerarySharedListDoc()
  @ResponsePaging('itinerary.list')
  @UserProtected()
  @AuthJwtAccessProtected()
  @ApiKeyProtected()
  @Get('')
  async list(
    @PaginationOffsetQuery({ availableSearch: ItineraryDefaultAvailableSearch })
    pagination: IPaginationQueryOffsetParams<
      Prisma.TransportItinerarySelect,
      Prisma.TransportItineraryWhereInput
    >,
    @PaginationQueryFilterInEnum<EnumFlightDirection>('direction', Object.values(EnumFlightDirection))
    direction?: Record<string, IPaginationIn>,
  ): Promise<IResponsePagingReturn<ItineraryResponseDto>> {
    return this.itineraryService.getListOffset(pagination, direction);
  }

  @ItinerarySharedGetDoc()
  @Response('itinerary.get')
  @UserProtected()
  @AuthJwtAccessProtected()
  @ApiKeyProtected()
  @Get(':itineraryId')
  async get(
    @Param('itineraryId') itineraryId: string,
  ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
    return this.itineraryService.getOne(itineraryId);
  }

  @ItinerarySharedCreateDoc()
  @Response('itinerary.create')
  @UserProtected()
  @AuthJwtAccessProtected()
  @ApiKeyProtected()
  @HttpCode(HttpStatus.CREATED)
  @Post('')
  async create(
    @Body() dto: CreateItineraryRequestDto,
  ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
    return this.itineraryService.create(dto);
  }
}
```

---

## i18n Messages

### `src/languages/en/itinerary.json`

```json
{
  "list": "Itinerary list",
  "get": "Itinerary detail",
  "create": "Itinerary created",
  "error": {
    "notFound": "Itinerary not found",
    "departAirportSameAsArrive": "Departure and arrival airports must be different",
    "arriveAtBeforeDepartAt": "Arrival time cannot be before departure time",
    "segmentChronologyInvalid": "Flight segments are not in chronological order: {details}",
    "airportHasSegments": "Cannot delete airport with active flight segments",
    "airportNotFound": "Airport {id} not found"
  }
}
```

---

## Module Registration

### `transport.module.ts` (update)

```typescript
import { AirportRepository } from '@modules/transport/airport/repositories/airport.repository';
import { AirportService } from '@modules/transport/airport/services/airport.service';
import { AirportUtil } from '@modules/transport/airport/utils/airport.util';
import { ItineraryRepository } from '@modules/transport/itinerary/repositories/itinerary.repository';
import { ItineraryService } from '@modules/transport/itinerary/services/itinerary.service';
import { ItineraryUtil } from '@modules/transport/itinerary/utils/itinerary.util';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  providers: [
    AirportService, AirportRepository, AirportUtil,
    ItineraryService, ItineraryRepository, ItineraryUtil,
  ],
  exports: [
    AirportService, AirportRepository, AirportUtil,
    ItineraryService, ItineraryRepository, ItineraryUtil,
  ],
  controllers: [],
})
export class TransportModule {}
```

### Router Registration

#### `routes.shared.module.ts` (update)

```typescript
// Add to existing RoutesSharedModule — keep all other imports/controllers intact
import { ItinerarySharedController } from '@modules/transport/itinerary/controllers/itinerary.shared.controller';
import { TransportModule } from '@modules/transport/transport.module';

@Module({
  imports: [
    // ... existing imports
    TransportModule,
  ],
  controllers: [
    // ... existing controllers
    ItinerarySharedController,
  ],
})
export class RoutesSharedModule {}
```

---

## Query Parameters & Pagination

### Create Endpoint (`POST /shared/v1/itineraries`)

Request body: `CreateItineraryRequestDto` (JSON).

Validation flow (all in service):
1. All `departAirportId` / `arriveAirportId` values are batch-fetched and must exist.
2. Per segment: `departAirportId !== arriveAirportId`.
3. `departAt` / `arriveAt` strings are interpreted as **local time in the respective airport's IANA timezone** and converted to UTC before persisting.
4. Per segment: `arriveAt >= departAt` (when both provided).
5. Across segments (sorted by `departAt asc`): adjacent `next.departAt >= prev.arriveAt` (when both provided).

Returns `201 Created` with the full `ItineraryWithSegmentsResponseDto` including UTC timestamps.

### List Endpoint (`GET /shared/v1/itineraries`)

| Parameter | Type | Default | Max | Description |
|---|---|---|---|---|
| `page` | `number` | 1 | — | Page number (1-based) |
| `perPage` | `number` | 20 | 100 | Items per page |
| `search` | `string` | — | 255 | Search in `name` field |
| `orderBy` | `string` | `createdAt:desc` | — | Sort field + direction |
| `direction` | `outbound \| return` | — | — | Filter by direction (enum) |

**Example requests:**
```
GET /v1/itineraries?page=1&perPage=20&search=outbound&direction=outbound&orderBy=createdAt:desc
GET /v1/itineraries?page=2&perPage=50&orderBy=name:asc
```

---

## Example Responses

### List Response

```json
{
  "type": "offset",
  "data": [
    {
      "id": "67cb5c1d8f9b8f2c00000001",
      "name": "John Doe - Outbound",
      "direction": "outbound",
      "createdAt": "2026-03-31T10:00:00.000Z",
      "updatedAt": "2026-03-31T10:00:00.000Z"
    }
  ],
  "page": 1,
  "perPage": 20,
  "count": 1,
  "totalPage": 1,
  "availableSearch": ["name"]
}
```

### Detail Response

```json
{
  "data": {
    "id": "67cb5c1d8f9b8f2c00000001",
    "name": "John Doe - Outbound",
    "direction": "outbound",
    "createdAt": "2026-03-31T10:00:00.000Z",
    "updatedAt": "2026-03-31T10:00:00.000Z",
    "segments": [
      {
        "id": "67cb5c1d8f9b8f2c00000010",
        "itineraryId": "67cb5c1d8f9b8f2c00000001",
        "airline": "United Airlines",
        "flightNumber": "UA101",
        "departAt": "2026-06-15T10:00:00.000Z",
        "arriveAt": "2026-06-15T14:30:00.000Z",
        "bookingRef": "ABC123",
        "notes": "2h layover in Chicago",
        "departAirport": {
          "id": "67cb5c1d8f9b8f2c12345001",
          "code": "JFK",
          "name": "John F. Kennedy International Airport",
          "timezone": "America/New_York",
          "city": "New York",
          "country": "United States",
          "createdAt": "2026-01-01T00:00:00.000Z",
          "updatedAt": "2026-01-01T00:00:00.000Z"
        },
        "arriveAirport": {
          "id": "67cb5c1d8f9b8f2c12345002",
          "code": "ORD",
          "name": "Chicago O'Hare International Airport",
          "timezone": "America/Chicago",
          "city": "Chicago",
          "country": "United States",
          "createdAt": "2026-01-01T00:00:00.000Z",
          "updatedAt": "2026-01-01T00:00:00.000Z"
        },
        "createdAt": "2026-03-31T10:00:00.000Z",
        "updatedAt": "2026-03-31T10:00:00.000Z"
      },
      {
        "id": "67cb5c1d8f9b8f2c00000011",
        "itineraryId": "67cb5c1d8f9b8f2c00000001",
        "airline": "United Airlines",
        "flightNumber": "UA456",
        "departAt": "2026-06-15T16:30:00.000Z",
        "arriveAt": "2026-06-16T06:15:00.000Z",
        "bookingRef": "ABC123",
        "notes": null,
        "departAirport": {
          "id": "67cb5c1d8f9b8f2c12345002",
          "code": "ORD",
          "name": "Chicago O'Hare International Airport",
          "timezone": "America/Chicago",
          "city": "Chicago",
          "country": "United States",
          "createdAt": "2026-01-01T00:00:00.000Z",
          "updatedAt": "2026-01-01T00:00:00.000Z"
        },
        "arriveAirport": {
          "id": "67cb5c1d8f9b8f2c12345003",
          "code": "LAX",
          "name": "Los Angeles International Airport",
          "timezone": "America/Los_Angeles",
          "city": "Los Angeles",
          "country": "United States",
          "createdAt": "2026-01-01T00:00:00.000Z",
          "updatedAt": "2026-01-01T00:00:00.000Z"
        },
        "createdAt": "2026-03-31T10:00:00.000Z",
        "updatedAt": "2026-03-31T10:00:00.000Z"
      }
    ]
  }
}
```

### Error Response

```json
{
  "statusCode": 6200,
  "message": "itinerary.error.notFound",
  "messageProperties": {
    "id": "67cb5c1d8f9b8f2c00000001"
  },
  "data": {
    "itineraryId": "67cb5c1d8f9b8f2c00000001"
  },
  "timestamp": "2026-03-31T10:00:00.000Z",
  "path": "/v1/itineraries/67cb5c1d8f9b8f2c00000001"
}
```

---

## Validation & Error Handling

### Validation Checklist

- [ ] `name` is 1–255 characters
- [ ] `direction` is `outbound` or `return` (enum)
- [ ] `segments` array is not empty and ≤ 10 items
- [ ] Each segment `flightNumber` is 1–20 characters
- [ ] Each segment `departAirportId` ≠ `arriveAirportId`
- [ ] Each segment `arriveAirportId` references an existing airport
- [ ] Both `departAirportId` and `arriveAirportId` reference existing airports (throw `airportNotFound`)
- [ ] If `arriveAt` and `departAt` both provided, `arriveAt >= departAt` (throw `arriveAtBeforeDepartAt`)
- [ ] Consecutive segments: if both have times, `segment[n+1].departAt >= segment[n].arriveAt` (throw `segmentChronologyInvalid`)

### Error Codes

| Code | Error | HTTP | Scenario |
|---|---|---|---|
| 6200 | `notFound` | 404 | Itinerary ID does not exist |
| 6201 | `departAirportSameAsArrive` | 400 | Segment has same departure and arrival airport |
| 6202 | `arriveAtBeforeDepartAt` | 400 | Segment arrival time is before departure time |
| 6203 | `segmentChronologyInvalid` | 400 | Segments are not in chronological order |
| 6204 | `airportHasSegments` | 400 | Cannot delete airport with segments |
| 6205 | `airportNotFound` | 400 | Referenced airport does not exist |
| 6206 | `invalidObjectId` | 400 | ID format is invalid |

---

## Implementation Phases

### Phase 1 (Current) — Read-Only Shared Endpoints
- [x] Prisma schema (already in boilerplate)
- [ ] Repository with pagination
- [ ] Service with mapping
- [ ] Exceptions & error handling
- [ ] Response DTOs
- [ ] Shared controller (list + get)
- [ ] Doc decorators
- [ ] i18n messages
- [ ] Module registration & router

**Deliverable:** `/itineraries` list + detail endpoints (backoffice only)

### Phase 2 (Future) — Create/Update Endpoints
- Add request DTOs
- Add validation pipes
- Add timezone conversion logic
- Add chronology validation
- Add transaction-based segment creation
- Add `POST /itineraries` endpoint
- Add `PATCH /itineraries/{id}` endpoint

### Phase 3 (Future) — User-Facing Endpoints
- Add participant ownership validation
- Add `GET /user/itineraries` endpoint
- Add `POST /user/itineraries/{id}/accept` endpoint
- Add authorization guards

### Phase 4 (Future) — Segment Management
- Add segment CRUD endpoints in `itinerary/segment/`
- Add segment update/delete with renumbering
- Add partial segment update without full reload

---

## Database Scripts

```bash
# After schema changes
pnpm db:generate

# View MongoDB data in Prisma Studio
pnpm db:studio

# Verify indexes created
# (MongoDB automatically creates @@index fields)
```

---

## Testing Checklist

### Unit Tests

- [ ] Repository: `findWithPaginationOffset` returns correct count and pagination
- [ ] Repository: `findOneWithSegments` includes sorted segments with airports
- [ ] Service: `getOne` throws `ItineraryNotFoundException` for missing ID
- [ ] Service: `getListOffset` applies direction filter correctly
- [ ] Util: `mapList` transforms all fields correctly
- [ ] Util: `mapOneWithSegments` includes all segment details and airports

### Integration Tests

- [ ] List endpoint returns 200 with paginated results
- [ ] List endpoint filters by `direction` correctly
- [ ] List endpoint searches by `name` correctly
- [ ] Detail endpoint returns 200 with embedded segments and airports
- [ ] Detail endpoint returns 404 for unknown ID
- [ ] Auth guards enforce `@UserProtected()`, `@AuthJwtAccessProtected()`, `@ApiKeyProtected()`
- [ ] Invalid ObjectId returns 400

### E2E Tests

- [ ] Full list flow: pagination, filtering, search
- [ ] Full detail flow: retrieve itinerary with 2+ segments
- [ ] Timezone conversion: local time → UTC storage (future phase)
- [ ] Chronology validation: reject invalid segment times (future phase)

---

## Performance Considerations

### Indexes
- `direction` — filtered in list queries
- `createdAt` — default sort field
- `itineraryId` — segment lookups
- `departAirportId`, `arriveAirportId` — airport joins

### Query Optimization
- Use Prisma `select` in pagination to avoid unnecessary fields
- Batch load airports in `findOneWithSegments` using `include`
- Avoid N+1 by always including airports with segments
- Pagination default `perPage=20` prevents large result sets

### Caching (Future)
- Cache itineraries by direction for 5 minutes
- Invalidate on segment updates
- Cache airport timezone lookups (rarely change)

---

## References

- **Project Architecture:** `CLAUDE.md` (CLAUDE Code instructions)
- **ACK Auth Patterns:** `docs/authentication.md`
- **Pagination:** `docs/pagination.md`
- **Response Patterns:** `docs/response.md`
- **Error Handling:** `docs/handling-error.md`
- **Airport Module:** `docs/ideas/transport/airports.md`
- **Product Feature:** Product/Features/flight-setup/Feature Overview.md
- **Data Model:** Product/Features/flight-setup/Data Model.md

---

## Notes for Implementers

1. **Path Aliases**: Always use `@modules/`, `@app/`, `@common/`, never relative imports
2. **Decorator Order**: Follow exact order in controller (doc → response → guards → pipe → method)
3. **Error Handling**: Use project exception classes, not `throw new Error()`
4. **Logging**: Log at service level with context; use `Logger.log()` not `console.log()`
5. **TypeScript Strict Mode**: Ensure `strict: true` in `tsconfig.json`
6. **i18n**: All user messages must be i18n keys, not hardcoded strings
7. **Testing**: Write tests as you implement, not at the end
8. **Timezone Handling**: Always convert to UTC before persisting; never assume UTC from input
9. **Database Transactions**: Use callback syntax for complex multi-step operations
10. **API Versioning**: Controller path includes `version: '1'` for future API versioning
