import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EnumSurveyQuestionType } from '@generated/prisma-client';

export class SurveySchemaOptionDto {
    @ApiProperty({
        description: 'Option value (submitted on selection)',
        example: 'opt_1',
        required: true,
    })
    value: string;

    @ApiProperty({
        description: 'Option display label',
        example: 'Option 1',
        required: true,
    })
    label: string;
}

export class SurveySchemaValidationDto {
    @ApiProperty({
        description: 'Minimum value (used for rating/number)',
        example: 1,
        required: false,
    })
    min?: number;

    @ApiProperty({
        description: 'Maximum value (used for rating/number)',
        example: 5,
        required: false,
    })
    max?: number;

    @ApiProperty({
        description: 'Whether text input is multiline',
        example: false,
        required: false,
    })
    multiline?: boolean;

    @ApiProperty({
        description: 'Maximum character length for text inputs',
        example: 500,
        required: false,
    })
    maxLength?: number;
}

export class SurveySchemaQuestionDto {
    @ApiProperty({
        description:
            'Internal question name/key used as identifier when submitting answers',
        example: 'satisfaction',
        required: true,
    })
    name: string;

    @ApiProperty({
        description: 'Question type',
        enum: EnumSurveyQuestionType,
        example: EnumSurveyQuestionType.text,
        required: true,
    })
    type: EnumSurveyQuestionType;

    @ApiProperty({
        description: 'Display label shown to the respondent',
        example: 'What is your full name?',
        required: true,
    })
    label: string;

    @ApiProperty({
        description: 'Whether this question must be answered before submission',
        example: true,
        required: true,
    })
    required: boolean;

    @ApiProperty({
        description: 'Placeholder text for the input',
        example: 'Enter your full name...',
        required: false,
    })
    placeholder?: string;

    @ApiProperty({
        description: 'Available options for select/radio/checkbox inputs',
        type: [SurveySchemaOptionDto],
        required: false,
        isArray: true,
    })
    @Type(() => SurveySchemaOptionDto)
    options?: SurveySchemaOptionDto[];

    @ApiProperty({
        description: 'Validation constraints for this question',
        type: SurveySchemaValidationDto,
        required: false,
    })
    @Type(() => SurveySchemaValidationDto)
    validation?: SurveySchemaValidationDto;
}

export class SurveySchemaSectionDto {
    @ApiProperty({
        description: 'Internal section name/key used as identifier when submitting answers',
        example: 'general',
        required: true,
    })
    name: string;

    @ApiProperty({
        description: 'Display label shown to the respondent',
        example: 'General Feedback',
        required: true,
    })
    label: string;

    @ApiProperty({
        description: 'Questions within this section',
        type: [SurveySchemaQuestionDto],
        required: true,
        isArray: true,
    })
    @Type(() => SurveySchemaQuestionDto)
    questions: SurveySchemaQuestionDto[];
}

export class SurveySchemaDto {
    @ApiProperty({
        description: 'Survey schema title',
        example: 'Customer Satisfaction Survey',
        required: true,
    })
    title: string;

    @ApiProperty({
        description: 'Survey schema description',
        example: 'Please help us improve by answering a few questions.',
        required: false,
    })
    description?: string;

    @ApiProperty({
        description: 'Survey sections containing grouped questions',
        type: [SurveySchemaSectionDto],
        required: true,
        isArray: true,
    })
    @Type(() => SurveySchemaSectionDto)
    sections: SurveySchemaSectionDto[];
}
