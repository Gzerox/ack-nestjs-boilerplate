import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FormResponseDto } from '@modules/form/dtos/response/form.response.dto';
import { FormResponseResponseDto } from '@modules/form/dtos/response/form-response.response.dto';

export class FormUserResponseDto extends OmitType(FormResponseDto, [
    'count',
] as const) {}

export class FormWithResponseResponseDto {
    @ApiProperty({ description: 'Form details', type: FormUserResponseDto, required: true })
    @Type(() => FormUserResponseDto)
    form: FormUserResponseDto;

    @ApiProperty({ description: 'User response record', type: FormResponseResponseDto, required: false, nullable: true })
    @Type(() => FormResponseResponseDto)
    response: FormResponseResponseDto | null;
}
