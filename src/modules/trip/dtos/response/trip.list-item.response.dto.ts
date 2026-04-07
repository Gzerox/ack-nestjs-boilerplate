import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { TripStatus } from '@generated/prisma-client';
import { TripFileAssetResponseDto } from '@modules/trip/dtos/response/trip-file-asset.response.dto';

export class TripListItemResponseDto extends DatabaseDto {
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

    @ApiProperty({ type: () => TripFileAssetResponseDto, required: false })
    @Type(() => TripFileAssetResponseDto)
    icon: TripFileAssetResponseDto | null;

    @ApiProperty({ type: () => TripFileAssetResponseDto, required: false })
    @Type(() => TripFileAssetResponseDto)
    coverImage: TripFileAssetResponseDto | null;

    @ApiProperty({ example: faker.date.future(), required: true })
    startDate: Date;

    @ApiProperty({ example: faker.date.future(), required: true })
    endDate: Date;

    @ApiProperty({ example: 'Europe/Rome', required: false })
    timezone: string | null;

    @ApiProperty({ enum: TripStatus, example: TripStatus.draft, required: true })
    status: TripStatus;
}
