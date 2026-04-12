import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsDate,
    IsEnum,
    IsMongoId,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
    ValidateNested,
} from 'class-validator';
import { ItineraryMaxSegments } from '@modules/transport/itinerary/constants/itinerary.list.constant';
import { EnumFlightDirection } from '@modules/transport/itinerary/enums/itinerary.enum';

export class TripItineraryCreateRequestDto {
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    name: string;

    @IsEnum(EnumFlightDirection)
    direction: EnumFlightDirection;

    @ArrayMaxSize(ItineraryMaxSegments)
    @ArrayMinSize(1)
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripItinerarySegmentCreateRequestDto)
    segments: TripItinerarySegmentCreateRequestDto[];
}
export class TripItinerarySegmentCreateRequestDto {
    @IsString()
    @MinLength(1)
    @MaxLength(20)
    flightNumber: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    airline?: string;

    @IsMongoId()
    @IsNotEmpty()
    departAirportId: string;

    @IsMongoId()
    @IsNotEmpty()
    arriveAirportId: string;

    @Type(() => Date)
    @IsDate()
    @IsOptional()
    departAt?: Date;

    @Type(() => Date)
    @IsDate()
    @IsOptional()
    arriveAt?: Date;

    @IsString()
    @IsOptional()
    @MaxLength(30)
    bookingRef?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    notes?: string;
}