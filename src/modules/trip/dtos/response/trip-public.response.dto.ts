import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';

export class TripPublicResponseDto {
    @ApiProperty({
        description: 'URL-friendly trip slug',
        example: 'summer-italy-trip-x8k2p1',
        required: true,
    })
    slug: string;

    @ApiProperty({
        description: 'Trip title',
        example: 'Summer Italy 2025',
        required: true,
    })
    title: string;

    @ApiProperty({
        description: 'Trip subtitle',
        example: 'Rome, Florence & Venice',
        required: false,
    })
    subtitle: string | null;

    @ApiProperty({
        description: 'Public icon URL',
        example: faker.internet.url(),
        required: false,
    })
    iconUrl: string | null;

    @ApiProperty({
        description: 'Public cover image URL',
        example: faker.internet.url(),
        required: false,
    })
    coverImageUrl: string | null;

    @ApiProperty({ example: faker.date.future(), required: true })
    startDate: Date;

    @ApiProperty({ example: faker.date.future(), required: true })
    endDate: Date;

    @ApiProperty({ example: 'Europe/Rome', required: false })
    timezone: string | null;
}
