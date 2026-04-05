import { AirportResponseDto } from '@modules/transport/airport/dtos/response/airport.response.dto';
import { faker } from '@faker-js/faker';
import { ItineraryResponseDto } from '@modules/transport/itinerary/dtos/response/itinerary.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class SegmentResponseDto {
    @ApiProperty({
        description: 'Flight segment identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    id: string;
    @ApiProperty({
        description: 'Parent itinerary identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    itineraryId: string;
    @ApiProperty({
        description: 'Airline name',
        example: 'ITA Airways',
        required: false,
        nullable: true,
    })
    airline: string | null;
    @ApiProperty({
        description: 'Flight number',
        example: 'AZ1234',
        required: true,
    })
    flightNumber: string;
    @ApiProperty({
        description: 'Departure time in UTC',
        example: faker.date.soon().toISOString(),
        required: true,
    })
    departAt: Date;
    @ApiProperty({
        description: 'Arrival time in UTC',
        example: faker.date.soon().toISOString(),
        required: true,
    })
    arriveAt: Date;
    @ApiProperty({
        description: 'Booking reference',
        example: 'ABC123',
        required: false,
        nullable: true,
    })
    bookingRef: string | null;
    @ApiProperty({
        description: 'Additional segment notes',
        example: 'Window seat requested',
        required: false,
        nullable: true,
    })
    notes: string | null;
    @ApiProperty({
        description: 'Departure airport',
        type: AirportResponseDto,
        required: true,
    })
    departAirport: AirportResponseDto;
    @ApiProperty({
        description: 'Arrival airport',
        type: AirportResponseDto,
        required: true,
    })
    arriveAirport: AirportResponseDto;
    @ApiProperty({
        description: 'Segment creation timestamp',
        example: faker.date.recent().toISOString(),
        required: true,
    })
    createdAt: Date;
    @ApiProperty({
        description: 'Segment update timestamp',
        example: faker.date.recent().toISOString(),
        required: true,
    })
    updatedAt: Date;
}

export class ItineraryWithSegmentsResponseDto extends ItineraryResponseDto {
    @ApiProperty({
        description: 'Ordered itinerary segments',
        type: SegmentResponseDto,
        isArray: true,
        required: true,
    })
    segments: SegmentResponseDto[];
}
