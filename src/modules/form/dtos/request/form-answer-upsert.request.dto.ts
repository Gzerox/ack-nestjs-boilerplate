import { IsArray, IsBoolean, IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class FormAnswerUpsertRequestDto {
    @IsString()
    @IsNotEmpty()
    sectionId: string;

    @IsString()
    @IsNotEmpty()
    questionId: string;

    @IsNumber()
    @IsOptional()
    numberValue?: number;

    @IsString()
    @IsOptional()
    optionValue?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    optionValues?: string[];

    @IsString()
    @IsOptional()
    textValue?: string;

    @IsBoolean()
    @IsOptional()
    booleanValue?: boolean;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    dateValue?: Date;
}
