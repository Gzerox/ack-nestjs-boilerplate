import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EnumSurveyStatus } from '@generated/prisma-client';

export class SurveyUserResponseDto {
    @ApiProperty({
        description: 'Survey identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    id: string;

    @ApiProperty({
        description: 'Survey title',
        example: faker.lorem.sentence(4),
        required: true,
    })
    title: string;

    @ApiProperty({
        description: 'Survey description',
        example: faker.lorem.paragraph(),
        required: false,
        nullable: true,
    })
    description: string | null;

    @ApiProperty({
        description: 'Date the survey closes and stops accepting responses',
        example: faker.date.future().toISOString(),
        required: false,
        nullable: true,
    })
    @Type(() => Date)
    closesAt: Date | null;

    @ApiProperty({
        description: 'Current survey status',
        enum: EnumSurveyStatus,
        example: EnumSurveyStatus.published,
        required: true,
    })
    status: EnumSurveyStatus;

    @ApiProperty({
        description: 'Date the survey was published',
        example: faker.date.recent().toISOString(),
        required: false,
        nullable: true,
    })
    @Type(() => Date)
    publishedAt: Date | null;
}
