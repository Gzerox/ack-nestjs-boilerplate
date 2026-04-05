import {
    IsDateString,
    IsMongoId,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateSegmentRequestDto {
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

    @IsDateString()
    @IsNotEmpty()
    departAt: string;

    @IsDateString()
    @IsNotEmpty()
    arriveAt: string;

    @IsString()
    @IsOptional()
    @MaxLength(30)
    bookingRef?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    notes?: string;
}
