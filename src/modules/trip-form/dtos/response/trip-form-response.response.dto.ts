import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EnumTripFormResponseStatus } from '@generated/prisma-client';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { TripFormAnswerResponseDto } from '@modules/trip-form/dtos/response/trip-form-answer.response.dto';

export class TripFormResponseResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'Trip form identifier',
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
        enum: EnumTripFormResponseStatus,
        example: EnumTripFormResponseStatus.pending,
        required: true,
    })
    status: EnumTripFormResponseStatus;

    @ApiProperty({
        description: 'Submitted answers',
        type: [TripFormAnswerResponseDto],
        required: false,
        isArray: true,
    })
    @Type(() => TripFormAnswerResponseDto)
    answers: TripFormAnswerResponseDto[];

    @ApiProperty({
        description: 'Date the response was submitted',
        example: faker.date.recent().toISOString(),
        required: false,
        nullable: true,
    })
    @Type(() => Date)
    submittedAt: Date | null;
}
