import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { TripStatus } from '@generated/prisma-client';

export class TripCreateDraftResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'Unique trip identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    id: string;

    @ApiProperty({
        description: 'URL-friendly trip slug',
        example: 'summer-italy-trip-x8k2p1',
        required: true,
    })
    slug: string;

    @ApiProperty({
        enum: TripStatus,
        example: TripStatus.draft,
        required: true,
    })
    status: TripStatus;
}
