import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import { SurveySchema } from '@generated/prisma-client';

export class SurveyTemplateCreateRequestDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsObject()
    @IsNotEmpty()
    schema: SurveySchema;
}

export class SurveyTemplateUpdateRequestDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsObject()
    @IsNotEmpty()
    schema: SurveySchema;
}
