import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FormAnswerUpsertDto } from '@modules/form/dtos/request/form-answer-upsert.dto';

export class FormSubmitRequestDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FormAnswerUpsertDto)
    @IsOptional()
    answers?: FormAnswerUpsertDto[];
}
