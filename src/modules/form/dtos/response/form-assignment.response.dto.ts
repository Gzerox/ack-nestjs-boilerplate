import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EnumFormResponseStatus } from '@generated/prisma-client';
import { DatabaseDto } from '@common/database/dtos/database.dto';

export class FormAssignmentResponseDto extends DatabaseDto {
    @ApiProperty({ description: 'Form identifier', example: faker.database.mongodbObjectId(), required: true })
    formId: string;

    @ApiProperty({ description: 'User identifier', example: faker.database.mongodbObjectId(), required: true })
    userId: string;

    @ApiProperty({ description: 'Whether this assignment is required', example: true, required: true })
    required: boolean;

    @ApiProperty({ description: 'Whether this assignment is active', example: true, required: true })
    isActive: boolean;

    @ApiProperty({ description: 'When the assignment window starts', example: faker.date.recent().toISOString(), required: false, nullable: true })
    @Type(() => Date)
    startsAt: Date | null;

    @ApiProperty({ description: 'When the assignment window closes', example: faker.date.future().toISOString(), required: false, nullable: true })
    @Type(() => Date)
    closesAt: Date | null;

    @ApiProperty({ description: 'Current response status', enum: EnumFormResponseStatus, example: EnumFormResponseStatus.pending, required: true })
    status: EnumFormResponseStatus;

    @ApiProperty({ description: 'Date the response was submitted', example: faker.date.recent().toISOString(), required: false, nullable: true })
    @Type(() => Date)
    submittedAt: Date | null;
}
