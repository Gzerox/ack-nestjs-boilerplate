import { DatabaseDto } from '@common/database/dtos/database.dto';
import { EnumAirportStatus } from '@modules/transport/airport/enums/airport.enum';
import { ApiProperty } from '@nestjs/swagger';

export class AirportResponseDto extends DatabaseDto {
    @ApiProperty({
        required: true,
        description: 'IATA airport code (3 letters), e.g. MXP',
        example: 'MXP',
        maxLength: 3,
        minLength: 3,
    })
    iataCode: string;

    @ApiProperty({
        required: true,
        description: 'ICAO airport code (4 letters), e.g. LIMC',
        example: 'LIMC',
        maxLength: 4,
        minLength: 4,
    })
    icaoCode: string;

    @ApiProperty({
        required: true,
        description: 'Full airport name',
        example: 'Milan Malpensa Airport',
    })
    name: string;

    @ApiProperty({
        required: false,
        description: 'Short display name',
        example: 'Malpensa',
    })
    shortName?: string;

    @ApiProperty({
        required: true,
        description: 'Main city associated with the airport',
        example: 'Milan',
    })
    city: string;

    @ApiProperty({
        required: true,
        description: 'Country name',
        example: 'Italy',
    })
    country: string;

    @ApiProperty({
        required: true,
        description: 'ISO country code',
        example: 'IT',
        maxLength: 2,
        minLength: 2,
    })
    countryCode: string;

    @ApiProperty({
        required: true,
        description: 'Continent name',
        example: 'Europe',
    })
    continent: string;

    @ApiProperty({
        required: false,
        description: 'Continent code (2 letters) - project-controlled set: AF, AN, AS, EU, NA, OC, SA',
        example: 'EU',
        maxLength: 2,
        minLength: 2,
    })
    continentCode?: string;

    @ApiProperty({
        required: true,
        description: 'IANA timezone identifier',
        example: 'Europe/Rome',
    })
    timezone: string;

    @ApiProperty({
        required: false,
        description: 'Currency code used in the country/area',
        example: 'EUR',
    })
    currencyCode?: string;

    @ApiProperty({
        required: true,
        description: 'Operational status of the airport',
        enum: EnumAirportStatus,
        example: EnumAirportStatus.active,
    })
    status: EnumAirportStatus;
}
