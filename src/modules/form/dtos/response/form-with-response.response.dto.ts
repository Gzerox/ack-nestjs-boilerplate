import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FormResponseDto } from '@modules/form/dtos/response/form.response.dto';
import { FormResponseResponseDto } from '@modules/form/dtos/response/form-response.response.dto';

export class FormWithResponseResponseDto {
    @ApiProperty({ description: 'Form details', type: FormResponseDto, required: true })
    @Type(() => FormResponseDto)
    form: FormResponseDto;

    @ApiProperty({ description: 'User response record', type: FormResponseResponseDto, required: false, nullable: true })
    @Type(() => FormResponseResponseDto)
    response: FormResponseResponseDto | null;
}
