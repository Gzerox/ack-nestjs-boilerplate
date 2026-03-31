import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

export class AirportSearchRequestDto {
    @ApiProperty({
        required: false,
        description: 'Search term for airport code, name, or city',
        example: 'MXP',
        maxLength: 100,
    })
    @MaxLength(100)
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    search?: string;

    @ApiProperty({
        required: false,
        description: 'Maximum number of results (1-20)',
        example: 10,
        default: 10,
        minimum: 1,
        maximum: 20,
    })
    @Max(20)
    @Min(1)
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    limit?: number;
}
