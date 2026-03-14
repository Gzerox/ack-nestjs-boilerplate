import {
    IsArray,
    IsDate,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SurveySchema } from '@generated/prisma-client';

export class SurveyCreateRequestDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsObject()
    @IsNotEmpty()
    schemaSnapshot: SurveySchema;

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    closesAt: Date;

    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    recipientUserIds: string[];

    @IsString()
    @IsOptional()
    sourceType?: string;

    @IsString()
    @IsOptional()
    sourceId?: string;
}
