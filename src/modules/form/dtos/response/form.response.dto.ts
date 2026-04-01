import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EnumFormKind, EnumFormStatus } from '@generated/prisma-client';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { FormSchemaDto } from '@modules/form/dtos/response/form-schema.dto';

export class FormAssignmentCountResponseDto {
    @ApiProperty({
        description: 'Total number of assignments for this form',
        example: 5,
        required: true,
    })
    assignments: number;
}

export class FormResponseStatusCountResponseDto {
    @ApiProperty({
        description: 'Number of responses pending submission for this form',
        example: 12,
        required: true,
    })
    pending: number;

    @ApiProperty({
        description: 'Number of submitted responses for this form',
        example: 8,
        required: true,
    })
    submitted: number;
}

export class FormCountResponseDto {
    @ApiProperty({
        description: 'Assignment counters for this form',
        type: FormAssignmentCountResponseDto,
        required: true,
    })
    @Type(() => FormAssignmentCountResponseDto)
    assignment: FormAssignmentCountResponseDto;

    @ApiProperty({
        description: 'Response status counters for this form',
        type: FormResponseStatusCountResponseDto,
        required: true,
    })
    @Type(() => FormResponseStatusCountResponseDto)
    response: FormResponseStatusCountResponseDto;
}

export class FormResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'User ID of the form creator',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    createdBy: string;

    @ApiProperty({
        description: 'Form kind',
        enum: EnumFormKind,
        example: EnumFormKind.survey,
        required: true,
    })
    kind: EnumFormKind;

    @ApiProperty({
        description: 'Form title',
        example: 'Post-trip feedback',
        required: true,
    })
    title: string;

    @ApiProperty({
        description: 'Form description',
        example: faker.lorem.paragraph(),
        required: false,
        nullable: true,
    })
    description: string | null;

    @ApiProperty({
        description: 'Form schema snapshot',
        type: FormSchemaDto,
        required: true,
    })
    @Type(() => FormSchemaDto)
    schemaSnapshot: FormSchemaDto;

    @ApiProperty({
        description: 'Date the form closes',
        example: faker.date.future().toISOString(),
        required: false,
        nullable: true,
    })
    @Type(() => Date)
    closesAt: Date | null;

    @ApiProperty({
        description: 'Current form status',
        enum: EnumFormStatus,
        example: EnumFormStatus.published,
        required: true,
    })
    status: EnumFormStatus;

    @ApiProperty({
        description: 'Date the form was published',
        example: faker.date.recent().toISOString(),
        required: false,
        nullable: true,
    })
    @Type(() => Date)
    publishedAt: Date | null;

    @ApiProperty({
        description: 'Aggregated counts for this form',
        type: FormCountResponseDto,
        required: false,
    })
    @Type(() => FormCountResponseDto)
    count?: FormCountResponseDto;
}
