import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { TripEventCategory } from '@generated/prisma-client';

export class TripCalendarEventResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'Event title',
        example: 'Hotel check-in',
        required: true,
    })
    title: string;

    @ApiProperty({
        enum: TripEventCategory,
        example: TripEventCategory.general,
        required: true,
    })
    category: TripEventCategory;

    @ApiProperty({
        description: 'Event start time',
        example: faker.date.future(),
        required: false,
    })
    startsAt: Date | null;

    @ApiProperty({
        description: 'Event end time',
        example: faker.date.future(),
        required: false,
    })
    endsAt: Date | null;

    @ApiProperty({
        description: 'Event location',
        example: 'Milan Malpensa Airport',
        required: false,
    })
    location: string | null;

    @ApiProperty({
        description: 'Event description',
        required: false,
    })
    description: string | null;
}
