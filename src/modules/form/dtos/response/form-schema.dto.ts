import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EnumFormQuestionType } from '@generated/prisma-client';

export class FormSchemaOptionDto {
    @ApiProperty({
        description: 'Option value submitted on selection',
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

export class FormSchemaValidationDto {
    @ApiProperty({ description: 'Minimum value', example: 1, required: false })
    min?: number;

    @ApiProperty({ description: 'Maximum value', example: 5, required: false })
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

export class FormSchemaQuestionDto {

    @ApiProperty({
        description: 'Question type',
        enum: EnumFormQuestionType,
        example: EnumFormQuestionType.text,
        required: true,
    })
    type: EnumFormQuestionType;

    @ApiProperty({
        description: 'Display label shown to the respondent',
        example: 'How would you rate the service?',
        required: true,
    })
    label: string;

    @ApiProperty({
        description: 'Supporting helper text shown with the question',
        example: 'Include details that help us follow up.',
        required: false,
    })
    supportText?: string;

    @ApiProperty({
        description: 'Whether this question must be answered',
        example: true,
        required: true,
    })
    required: boolean;

    @ApiProperty({
        description: 'Placeholder text for the input',
        example: 'Enter your answer...',
        required: false,
    })
    placeholder?: string;

    @ApiProperty({
        description: 'Available options for select inputs',
        type: [FormSchemaOptionDto],
        required: false,
        isArray: true,
    })
    @Type(() => FormSchemaOptionDto)
    options?: FormSchemaOptionDto[];

    @ApiProperty({
        description: 'Validation constraints',
        type: FormSchemaValidationDto,
        required: false,
    })
    @Type(() => FormSchemaValidationDto)
    validation?: FormSchemaValidationDto;
}

export class FormSchemaSectionDto {

    @ApiProperty({
        description: 'Display label',
        example: 'Agency Feedback',
        required: false,
    })
    label?: string;

    @ApiProperty({
        description: 'Questions within this section',
        type: [FormSchemaQuestionDto],
        required: true,
        isArray: true,
    })
    @Type(() => FormSchemaQuestionDto)
    questions: FormSchemaQuestionDto[];
}

export class FormSchemaDto {
    @ApiProperty({
        description: 'Form schema title',
        example: 'Post-trip feedback',
        required: true,
    })
    title: string;

    @ApiProperty({ description: 'Form schema description', required: false })
    description?: string;

    @ApiProperty({
        description: 'Form sections',
        type: [FormSchemaSectionDto],
        required: true,
        isArray: true,
    })
    @Type(() => FormSchemaSectionDto)
    sections: FormSchemaSectionDto[];
}
