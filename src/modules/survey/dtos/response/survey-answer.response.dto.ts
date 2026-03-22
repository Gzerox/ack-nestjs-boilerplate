import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';

export class SurveyAnswerResponseDto {
    @ApiProperty({
        description: 'Question identifier within the survey schema',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    questionId: string;

    @ApiProperty({
        description: 'Section identifier within the survey schema',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    sectionId: string;

    @ApiProperty({
        description: 'Text answer value',
        example: 'Paris',
        required: false,
        nullable: true,
    })
    textValue?: string | null;

    @ApiProperty({
        description: 'Numeric answer value',
        example: 42,
        required: false,
        nullable: true,
    })
    numberValue?: number | null;

    @ApiProperty({
        description: 'Single selected option value',
        example: 'opt_2',
        required: false,
        nullable: true,
    })
    optionValue?: string | null;

    @ApiProperty({
        description: 'Multiple selected option values',
        example: ['opt_1', 'opt_3'],
        required: false,
        isArray: true,
        type: [String],
    })
    optionValues?: string[];
}
