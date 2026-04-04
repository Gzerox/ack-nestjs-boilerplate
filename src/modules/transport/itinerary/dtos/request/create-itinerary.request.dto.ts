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
import { EnumFlightDirection } from '../../enums/itinerary.enum';
import { CreateSegmentRequestDto } from './create-segments.request.dto';

export class CreateItineraryRequestDto {
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    name: string;

    @IsEnum(EnumFlightDirection)
    direction: EnumFlightDirection;

    @ArrayMaxSize(10)
    @ArrayMinSize(1)
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSegmentRequestDto)
    segments: CreateSegmentRequestDto[];
}
