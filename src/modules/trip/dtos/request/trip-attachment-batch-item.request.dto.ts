import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TripAttachmentType } from '@generated/prisma-client';

export class TripAttachmentBatchItemRequestDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsEnum(TripAttachmentType)
    @IsNotEmpty()
    type: TripAttachmentType;

    @IsString()
    @IsOptional()
    displayName?: string;
}
