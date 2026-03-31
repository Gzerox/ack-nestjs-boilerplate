import { ApiProperty } from '@nestjs/swagger';

export class AirportSearchResponseDto {
    @ApiProperty({
        description: 'Airport ID',
        example: '67cb5c1d8f9b8f2c12345678',
    })
    id: string;

    @ApiProperty({
        description: 'IATA airport code (3 letters)',
        example: 'MXP',
        maxLength: 3,
        minLength: 3,
    })
    iataCode: string;

    @ApiProperty({
        description: 'Full airport name',
        example: 'Milan Malpensa Airport',
    })
    name: string;

    @ApiProperty({
        description: 'Main city associated with the airport',
        example: 'Milan',
    })
    city: string;

    @ApiProperty({
        description: 'Country name',
        example: 'Italy',
    })
    country: string;

    @ApiProperty({
        description: 'IANA timezone identifier',
        example: 'Europe/Rome',
    })
    timezone: string;
}
