import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsString,
    MaxLength,
    MinLength,
    ValidateNested,
} from 'class-validator';
import { ItineraryMaxSegments } from '@modules/transport/itinerary/constants/itinerary.list.constant';
import { EnumFlightDirection } from '@modules/transport/itinerary/enums/itinerary.enum';
import { CreateSegmentRequestDto } from '@modules/transport/itinerary/dtos/request/create-segments.request.dto';

export class CreateItineraryRequestDto {
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
    @Type(() => CreateSegmentRequestDto)
    segments: CreateSegmentRequestDto[];
}
