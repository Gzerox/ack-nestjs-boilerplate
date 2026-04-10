import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TripMediaKind } from '@generated/prisma-client';

export class TripMediaBatchItemRequestDto {
    @IsEnum(TripMediaKind)
    @IsNotEmpty()
    kind: TripMediaKind;

    @IsString()
    @IsOptional()
    caption?: string;

    @IsMongoId()
    @IsOptional()
    calendarEventId?: string;
}
