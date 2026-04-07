import {
    IsDate,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TripEventCategory } from '@generated/prisma-client';

export class TripCalendarEventCreateRequestDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsEnum(TripEventCategory)
    @IsNotEmpty()
    category: TripEventCategory;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    startsAt?: Date;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    endsAt?: Date;

    @IsString()
    @IsOptional()
    location?: string;

    @IsString()
    @IsOptional()
    description?: string;
}
