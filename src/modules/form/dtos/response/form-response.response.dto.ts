import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EnumFormResponseStatus } from '@generated/prisma-client';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { FormAnswerResponseDto } from '@modules/form/dtos/response/form-answer.response.dto';

export class FormResponseResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'Form identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    formId: string;

    @ApiProperty({
        description: 'Respondent user identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    userId: string;

    @ApiProperty({
        description: 'Current response status',
        enum: EnumFormResponseStatus,
        example: EnumFormResponseStatus.pending,
        required: true,
    })
    status: EnumFormResponseStatus;

    @ApiProperty({
        description: 'Submitted answers',
        type: [FormAnswerResponseDto],
        required: false,
        isArray: true,
    })
    @Type(() => FormAnswerResponseDto)
    answers: FormAnswerResponseDto[];

    @ApiProperty({
        description: 'Date the response was submitted',
        example: faker.date.recent().toISOString(),
        required: false,
        nullable: true,
    })
    @Type(() => Date)
    submittedAt: Date | null;
}
