---
title: Transport Itinerary & Flight Segments Implementation Spec
aliases:
  - Flight Setup/Itinerary
status: ready-to-implement
stage: implementation
feature_id: flight-setup
owner: backend
last_reviewed: 2026-03-31
source_of_truth: ACK NestJS Boilerplate Architecture + Product Features
ai_ready: true
note_type: implementation-spec
---

## Scope

This specification covers **end-to-end implementation** of `TransportItinerary` and `TransportFlightSegment` in the transport module.

**Out of scope (deferred):**
- Participant assignment models (`FlightItineraryParticipant`, `FlightSegmentParticipant`)
- User-facing itinerary endpoints (participant ownership required)
- Trip module integration (addressed in separate Trip spec)
- Segment CRUD endpoints (to be added when needed in separate spec)

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
  name      String               @db.String
  direction EnumFlightDirection

  segments  TransportFlightSegment[]

  createdAt DateTime             @default(now())
  createdBy String?              @db.ObjectId
  updatedAt DateTime             @updatedAt
  updatedBy String?              @db.ObjectId

  @@index(fields: [direction])
  @@index(fields: [createdAt])
  @@map("TransportItineraries")
}

model TransportFlightSegment {
  id              String     @id @default(auto()) @map("_id") @db.ObjectId
  itineraryId     String     @db.ObjectId
  order           Int
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

  @@unique(fields: [itineraryId, order])
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
| `name` | `string` | 1–255 chars, required | Free text label, e.g. "John Doe outbound" |
| `direction` | `EnumFlightDirection` | `outbound` or `return`, required | Enum only; no null |
| `createdBy` | `string` | ObjectId or null | Audit trail; not user-set |
| `updatedBy` | `string` | ObjectId or null | Audit trail; not user-set |

### TransportFlightSegment

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `itineraryId` | `string` | Valid ObjectId, required | Must reference existing `TransportItinerary` |
| `order` | `number` | Integer ≥ 1, required, unique per itinerary | 1-based; no gaps allowed |
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
- Consecutive segments: if both have times, `segment[n+1].departAt >= segment[n].arriveAt` — reject with `segmentChronologyInvalid`
- Unknown ObjectIds → throw `NotFoundException` with `itineraryNotFound` or `airportNotFound`

---

## Business Rules

### Multi-stop routes
Multi-leg flights are modeled as multiple `TransportFlightSegment` rows ordered by `order`.

Example: `MXP → FCO → JFK`
```
Itinerary "User A outbound"
├── Segment 1: MXP → FCO, order=1
└── Segment 2: FCO → JFK, order=2
```

### Order contiguity
- When creating segments in bulk, `order` must be contiguous and 1-based: `[1, 2, 3, ...]`
- No sparse ordering allowed (gaps rejected)
- Future deletion/editing may require renumbering service

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
2. Consecutive segments: if segment `n` and `n+1` both have times, `segment[n+1].departAt >= segment[n].arriveAt`
3. DST transitions must be handled by timezone-aware libraries (e.g., `date-fns-tz`, `moment-timezone`)
4. Do not silently reorder; reject invalid chronology

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
    ├── pipes/
    │   └── validate-itinerary-chronology.pipe.ts
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
import { IsEnum, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { EnumFlightDirection } from '../enums/itinerary.enum';
import { CreateSegmentRequestDto } from './create-segments.request.dto';

export class CreateItineraryRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsEnum(EnumFlightDirection)
  direction: EnumFlightDirection;

  @ValidateNested({ each: true })
  @Type(() => CreateSegmentRequestDto)
  segments: CreateSegmentRequestDto[];
}
```

#### `create-segments.request.dto.ts`

```typescript
import { Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSegmentRequestDto {
  @IsNumber()
  @IsNotEmpty()
  order: number;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  flightNumber: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  airline?: string;

  @IsString()
  @IsNotEmpty()
  departAirportId: string;

  @IsString()
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
  order: number;
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
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '@app/common/database/services/database.service';
import { PaginationService } from '@app/common/pagination/services/pagination.service';
import { IPaginationQueryOffsetParams } from '@app/common/pagination/interfaces/pagination.interface';

@Injectable()
export class ItineraryRepository {
  private readonly logger = new Logger(ItineraryRepository.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly paginationService: PaginationService,
  ) {}

  async findWithPaginationOffset(
    pagination: IPaginationQueryOffsetParams<
      Prisma.TransportItinerarySelect,
      Prisma.TransportItineraryWhereInput
    >,
    directions?: string[],
  ) {
    const { offset, limit, sort, where } = pagination;

    const whereClause: Prisma.TransportItineraryWhereInput = {
      ...where,
      ...(directions && directions.length > 0 ? { direction: { in: directions } } : {}),
    };

    const [data, count] = await this.databaseService.$transaction([
      this.databaseService.transportItinerary.findMany({
        where: whereClause,
        select: pagination.select,
        orderBy: sort as Prisma.TransportItineraryOrderByWithRelationInput,
        skip: offset,
        take: limit,
      }),
      this.databaseService.transportItinerary.count({ where: whereClause }),
    ]);

    return { data, count };
  }

  async findOneById(id: string) {
    return this.databaseService.transportItinerary.findUnique({
      where: { id },
    });
  }

  async findOneWithSegments(id: string) {
    return this.databaseService.transportItinerary.findUnique({
      where: { id },
      include: {
        segments: {
          orderBy: { order: 'asc' },
          include: {
            departAirport: true,
            arriveAirport: true,
          },
        },
      },
    });
  }

  async create(data: Prisma.TransportItineraryCreateInput) {
    return this.databaseService.transportItinerary.create({
      data,
      include: { segments: true },
    });
  }

  async update(id: string, data: Prisma.TransportItineraryUpdateInput) {
    return this.databaseService.transportItinerary.update({
      where: { id },
      data,
      include: { segments: true },
    });
  }

  async delete(id: string) {
    return this.databaseService.transportItinerary.delete({
      where: { id },
    });
  }
}
```

---

## Service Interface

### `itinerary.service.interface.ts`

```typescript
import { IResponseReturn, IResponsePagingReturn } from '@app/common/response/interfaces/response.interface';
import { IPaginationQueryOffsetParams } from '@app/common/pagination/interfaces/pagination.interface';
import { Prisma } from '@prisma/client';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';

export interface IItineraryService {
  getListOffset(
    pagination: IPaginationQueryOffsetParams<
      Prisma.TransportItinerarySelect,
      Prisma.TransportItineraryWhereInput
    >,
    directions?: string[],
  ): Promise<IResponsePagingReturn<ItineraryResponseDto>>;

  getOne(id: string): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>>;
}
```

---

## Service

### `itinerary.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ItineraryRepository } from '../repositories/itinerary.repository';
import { ItineraryUtil } from '../utils/itinerary.util';
import { IItineraryService } from '../interfaces/itinerary.service.interface';
import { IPaginationQueryOffsetParams } from '@app/common/pagination/interfaces/pagination.interface';
import { Prisma } from '@prisma/client';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';
import { IResponseReturn, IResponsePagingReturn } from '@app/common/response/interfaces/response.interface';
import { ItineraryNotFoundException } from '../exceptions/itinerary.exception';

@Injectable()
export class ItineraryService implements IItineraryService {
  private readonly logger = new Logger(ItineraryService.name);

  constructor(
    private readonly itineraryRepository: ItineraryRepository,
    private readonly itineraryUtil: ItineraryUtil,
  ) {}

  async getListOffset(
    pagination: IPaginationQueryOffsetParams<
      Prisma.TransportItinerarySelect,
      Prisma.TransportItineraryWhereInput
    >,
    directions?: string[],
  ): Promise<IResponsePagingReturn<ItineraryResponseDto>> {
    const { data, count } = await this.itineraryRepository.findWithPaginationOffset(
      pagination,
      directions,
    );

    const mapped = this.itineraryUtil.mapList(data);
    const paginationInfo = this.itineraryRepository.getOffsetPaginationInfo(pagination, count);

    return {
      type: 'offset',
      data: mapped,
      count,
      ...paginationInfo,
    };
  }

  async getOne(id: string): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
    const itinerary = await this.itineraryRepository.findOneWithSegments(id);

    if (!itinerary) {
      throw new ItineraryNotFoundException(id);
    }

    this.logger.log(`Fetched itinerary: ${id}`);

    return {
      data: this.itineraryUtil.mapOneWithSegments(itinerary),
    };
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
      order: segment.order,
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
import { Doc } from '@app/common/doc/decorators/doc.decorator';
import { DocAuth } from '@app/common/doc/decorators/doc-auth.decorator';
import { DocResponsePaging } from '@app/common/doc/decorators/doc-response-paging.decorator';
import { DocResponse } from '@app/common/doc/decorators/doc-response.decorator';
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
```

---

## Controller

### `itinerary.shared.controller.ts`

```typescript
import { Controller, Get, Param, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestRequiredPipe } from '@app/common/request/pipes/request.required.pipe';
import { RequestIsValidObjectIdPipe } from '@app/common/request/pipes/request-is-valid-object-id.pipe';
import { UserProtected } from '@app/common/auth/decorators/user.protected.decorator';
import { AuthJwtAccessProtected } from '@app/common/auth/decorators/auth-jwt-access.protected.decorator';
import { ApiKeyProtected } from '@app/common/auth/decorators/api-key.protected.decorator';
import { Response } from '@app/common/response/decorators/response.decorator';
import { ResponsePaging } from '@app/common/response/decorators/response-paging.decorator';
import { PaginationQueryOffset } from '@app/common/pagination/decorators/pagination-query-offset.decorator';
import { PaginationQueryFilterInEnum } from '@app/common/pagination/decorators/pagination-query-filter-in-enum.decorator';
import { IPaginationQueryOffsetParams } from '@app/common/pagination/interfaces/pagination.interface';
import { Prisma } from '@prisma/client';
import { ItineraryService } from '../services/itinerary.service';
import { ItinerarySharedListDoc, ItinerarySharedGetDoc } from '../docs/itinerary.shared.doc';
import { EnumFlightDirection } from '../enums/itinerary.enum';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';

@ApiTags('modules.shared.itinerary')
@Controller({
  path: 'itineraries',
  version: '1',
})
export class ItinerarySharedController {
  private readonly logger = new Logger(ItinerarySharedController.name);

  constructor(private readonly itineraryService: ItineraryService) {}

  @ItinerarySharedListDoc()
  @ResponsePaging('itinerary.list')
  @UserProtected()
  @AuthJwtAccessProtected()
  @ApiKeyProtected()
  @PaginationQueryOffset()
  @PaginationQueryFilterInEnum('direction', Object.values(EnumFlightDirection))
  @Get('')
  async list(
    @PaginationQueryOffset() pagination: IPaginationQueryOffsetParams<
      Prisma.TransportItinerarySelect,
      Prisma.TransportItineraryWhereInput
    >,
    @PaginationQueryFilterInEnum('direction') directions?: Record<string, any>,
  ) {
    const directionFilters = directions?.direction ? (directions.direction as string[]) : undefined;
    return this.itineraryService.getListOffset(pagination, directionFilters);
  }

  @ItinerarySharedGetDoc()
  @Response('itinerary.get')
  @UserProtected()
  @AuthJwtAccessProtected()
  @ApiKeyProtected()
  @Get(':itineraryId')
  async get(
    @Param('itineraryId', RequestRequiredPipe, RequestIsValidObjectIdPipe) itineraryId: string,
  ) {
    this.logger.log(`Fetching itinerary: ${itineraryId}`);
    return this.itineraryService.getOne(itineraryId);
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
  "error": {
    "notFound": "Itinerary not found",
    "departAirportSameAsArrive": "Departure and arrival airports must be different",
    "arriveAtBeforeDepartAt": "Arrival time cannot be before departure time",
    "segmentChronologyInvalid": "Flight segments are not in chronological order",
    "airportHasSegments": "Cannot delete airport with active flight segments",
    "airportNotFound": "Airport not found"
  }
}
```

---

## Module Registration

### `transport.module.ts` (update)

```typescript
import { Module } from '@nestjs/common';
import { AirportModule } from './airport/airport.module';
import { ItineraryRepository } from './itinerary/repositories/itinerary.repository';
import { ItineraryService } from './itinerary/services/itinerary.service';
import { ItineraryUtil } from './itinerary/utils/itinerary.util';

@Module({
  imports: [AirportModule],
  providers: [ItineraryRepository, ItineraryService, ItineraryUtil],
  exports: [ItineraryRepository, ItineraryService, ItineraryUtil],
})
export class TransportModule {}
```

### Router Registration

#### `routes.shared.module.ts` (update)

```typescript
import { Module } from '@nestjs/common';
import { TransportModule } from '@modules/transport/transport.module';
import { ItinerarySharedController } from '@modules/transport/itinerary/controllers/itinerary.shared.controller';

@Module({
  imports: [TransportModule],
  controllers: [ItinerarySharedController],
})
export class RoutesSharedModule {}
```

---

## Query Parameters & Pagination

### List Endpoint (`GET /itineraries`)

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
        "order": 1,
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
        "order": 2,
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
- [ ] Each segment `order` is unique within itinerary and 1-based with no gaps
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
