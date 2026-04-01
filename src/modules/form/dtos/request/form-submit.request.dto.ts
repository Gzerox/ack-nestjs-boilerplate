import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FormAnswerUpsertRequestDto } from '@modules/form/dtos/request/form-answer-upsert.request.dto';

export class FormSubmitRequestDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FormAnswerUpsertRequestDto)
    @IsOptional()
    answers?: FormAnswerUpsertRequestDto[];
}
