import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EnumTripFormKind, EnumTripFormStatus } from '@generated/prisma-client';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { TripFormSchemaDto } from '@modules/trip-form/dtos/response/trip-form-schema.dto';

export class TripFormAssignmentCountResponseDto {
    @ApiProperty({
        description: 'Total number of assignments for this form',
        example: 5,
        required: true,
    })
    assignments: number;
}

export class TripFormResponseStatusCountResponseDto {
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

export class TripFormCountResponseDto {
    @ApiProperty({
        description: 'Assignment counters for this form',
        type: TripFormAssignmentCountResponseDto,
        required: true,
    })
    @Type(() => TripFormAssignmentCountResponseDto)
    assignment: TripFormAssignmentCountResponseDto;

    @ApiProperty({
        description: 'Response status counters for this form',
        type: TripFormResponseStatusCountResponseDto,
        required: true,
    })
    @Type(() => TripFormResponseStatusCountResponseDto)
    response: TripFormResponseStatusCountResponseDto;
}

export class TripFormResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'User ID of the form creator',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    createdBy: string;

    @ApiProperty({
        description: 'Trip identifier this form belongs to',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    tripId: string;

    @ApiProperty({
        description: 'Template identifier if cloned from a template',
        example: faker.database.mongodbObjectId(),
        required: false,
        nullable: true,
    })
    templateId: string | null;

    @ApiProperty({
        description: 'Form kind',
        enum: EnumTripFormKind,
        example: EnumTripFormKind.survey,
        required: true,
    })
    kind: EnumTripFormKind;

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
        description: 'Form schema',
        type: TripFormSchemaDto,
        required: true,
    })
    @Type(() => TripFormSchemaDto)
    schemaSnapshot: TripFormSchemaDto;

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
        enum: EnumTripFormStatus,
        example: EnumTripFormStatus.published,
        required: true,
    })
    status: EnumTripFormStatus;

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
        type: TripFormCountResponseDto,
        required: false,
    })
    @Type(() => TripFormCountResponseDto)
    count?: TripFormCountResponseDto;
}
