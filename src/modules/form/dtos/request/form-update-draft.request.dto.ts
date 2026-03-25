import { IsArray, IsDate, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FormSchemaSectionRequestDto } from '@modules/form/dtos/request/form-schema.request.dto';

export class FormUpdateDraftRequestDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    closesAt?: Date;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FormSchemaSectionRequestDto)
    @IsOptional()
    sections?: FormSchemaSectionRequestDto[];
}
