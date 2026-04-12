import { DatabaseDto } from '@common/database/dtos/database.dto';
import { ApiProperty } from '@nestjs/swagger';
import { EnumFlightDirection } from '@generated/prisma-client';
import { faker } from '@faker-js/faker';

export class ItineraryResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'Trip this itinerary belongs to',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    tripId: string;

    @ApiProperty({
        description: 'Itinerary display name',
        example: 'Sample Guest - Outbound',
        required: true,
    })
    name: string;

    @ApiProperty({
        description: 'Flight direction',
        enum: EnumFlightDirection,
        example: EnumFlightDirection.outbound,
        required: true,
    })
    direction: EnumFlightDirection;
}
