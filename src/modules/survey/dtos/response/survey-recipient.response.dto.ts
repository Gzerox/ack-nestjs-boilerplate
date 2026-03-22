import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { SurveyAnswerResponseDto } from '@modules/survey/dtos/response/survey-answer.response.dto';
import { $Enums } from '@prisma/client';
import EnumSurveyRecipientStatus = $Enums.EnumSurveyRecipientStatus;

export class SurveyRecipientResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'Survey identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    surveyId: string;

    @ApiProperty({
        description: 'Recipient user identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    userId: string;

    @ApiProperty({
        description: 'Current completion status of the recipient',
        enum: EnumSurveyRecipientStatus,
        example: EnumSurveyRecipientStatus.notStarted,
        required: true,
    })
    status: EnumSurveyRecipientStatus;

    @ApiProperty({
        description: 'Saved or submitted answers',
        type: [SurveyAnswerResponseDto],
        required: false,
        nullable: true,
        isArray: true,
    })
    @Type(() => SurveyAnswerResponseDto)
    answers: SurveyAnswerResponseDto[] | null;

    @ApiProperty({
        description: 'Date the recipient submitted the survey',
        example: faker.date.recent().toISOString(),
        required: false,
        nullable: true,
    })
    @Type(() => Date)
    submittedAt: Date | null;
}
