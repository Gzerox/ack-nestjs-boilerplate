import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { TripMediaKind } from '@generated/prisma-client';
import { TripFileAssetResponseDto } from '@modules/trip/dtos/response/trip-file-asset.response.dto';

export class TripMediaResponseDto extends DatabaseDto {
    @ApiProperty({ required: true })
    tripId: string;

    @ApiProperty({ required: false })
    calendarEventId: string | null;

    @ApiProperty({ enum: TripMediaKind, required: true })
    kind: TripMediaKind;

    @ApiProperty({ type: () => TripFileAssetResponseDto, required: true })
    @Type(() => TripFileAssetResponseDto)
    file: TripFileAssetResponseDto;

    @ApiProperty({ required: false })
    caption: string | null;

    @ApiProperty({ required: true })
    createdBy: string;
}
