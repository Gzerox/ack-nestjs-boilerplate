import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class FormAnswerResponseDto {
    @ApiProperty({ description: 'Question identifier', example: 'agency_overall_rating', required: true })
    questionId: string;

    @ApiProperty({ description: 'Section identifier', example: 'agency', required: true })
    sectionId: string;

    @ApiProperty({ description: 'Text answer value', example: 'Great experience', required: false, nullable: true })
    textValue?: string | null;

    @ApiProperty({ description: 'Numeric answer value', example: 4, required: false, nullable: true })
    numberValue?: number | null;

    @ApiProperty({ description: 'Single selected option value', example: 'opt_2', required: false, nullable: true })
    optionValue?: string | null;

    @ApiProperty({ description: 'Multiple selected option values', example: ['opt_1', 'opt_3'], required: false, isArray: true, type: [String] })
    optionValues?: string[];

    @ApiProperty({ description: 'Boolean answer value', example: true, required: false, nullable: true })
    booleanValue?: boolean | null;

    @ApiProperty({ description: 'Date answer value', example: faker.date.recent().toISOString(), required: false, nullable: true })
    @Type(() => Date)
    dateValue?: Date | null;
}
