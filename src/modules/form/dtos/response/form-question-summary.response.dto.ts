import { ApiProperty } from '@nestjs/swagger';
import { EnumFormQuestionType } from '@generated/prisma-client';

export class FormQuestionBreakdownItemDto {
    @ApiProperty({
        description:
            'Answer value (option label, boolean, numeric bucket, etc.)',
        example: 'opt_1',
        required: true,
        nullable: true,
    })
    value: string | number | boolean | null;

    @ApiProperty({
        description: 'Number of responses with this value',
        example: 15,
        required: true,
    })
    count: number;
}

export class FormQuestionSummaryResponseDto {
    @ApiProperty({
        description: 'Published question identifier',
        example: '507f1f77bcf86cd799439011',
        required: true,
    })
    questionId: string;

    @ApiProperty({
        description: 'Question type',
        enum: EnumFormQuestionType,
        required: true,
    })
    type: EnumFormQuestionType;

    @ApiProperty({
        description: 'Total number of responses that answered this question',
        example: 80,
        required: true,
    })
    totalResponses: number;

    @ApiProperty({
        description: 'Breakdown of answer values and their counts',
        type: [FormQuestionBreakdownItemDto],
        required: true,
        isArray: true,
    })
    breakdown: FormQuestionBreakdownItemDto[];
}
