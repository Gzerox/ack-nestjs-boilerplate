import { IsArray, IsMongoId, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FormAnswerUpsertDto } from '@modules/form/dtos/request/form-answer-upsert.dto';

export class FormSubmitRequestDto {
    @IsMongoId()
    @IsNotEmpty()
    assignmentId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FormAnswerUpsertDto)
    @IsOptional()
    answers?: FormAnswerUpsertDto[];
}
