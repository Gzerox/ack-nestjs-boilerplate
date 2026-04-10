import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { TripAttachmentType } from '@generated/prisma-client';
import { TripFileAssetResponseDto } from '@modules/trip/dtos/response/trip-file-asset.response.dto';

export class TripAttachmentResponseDto extends DatabaseDto {
    @ApiProperty({ required: true })
    tripId: string;

    @ApiProperty({ required: true })
    title: string;

    @ApiProperty({ enum: TripAttachmentType, required: true })
    type: TripAttachmentType;

    @ApiProperty({ required: false })
    contentMarkdown: string | null;

    @ApiProperty({ type: () => TripFileAssetResponseDto, required: false })
    @Type(() => TripFileAssetResponseDto)
    file: TripFileAssetResponseDto | null;

    @ApiProperty({ required: false })
    displayName: string | null;

    @ApiProperty({ required: true })
    required: boolean;

    @ApiProperty({ required: true })
    createdBy: string;
}
