import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import { SurveySchema } from '@generated/prisma-client';

export class SurveyTemplateUpdateRequestDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsObject()
    @IsNotEmpty()
    schema: SurveySchema;
}
