import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TripFormResponseDto } from '@modules/trip-form/dtos/response/trip-form.response.dto';
import { TripFormResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-response.response.dto';

export class TripFormUserResponseDto extends OmitType(TripFormResponseDto, [
    'count',
] as const) {}

export class TripFormWithResponseResponseDto {
    @ApiProperty({ description: 'Form details', type: TripFormUserResponseDto, required: true })
    @Type(() => TripFormUserResponseDto)
    form: TripFormUserResponseDto;

    @ApiProperty({ description: 'User response record', type: TripFormResponseResponseDto, required: false, nullable: true })
    @Type(() => TripFormResponseResponseDto)
    response: TripFormResponseResponseDto | null;
}
