import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { EnumFormKind, EnumFormStatus } from '@generated/prisma-client';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { FormSchemaDto } from '@modules/form/dtos/response/form-schema.dto';

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
        description: 'Total number of assignments for this form',
        example: 5,
        required: false,
    })
    @Transform(({ value }) => value?.assignments ?? undefined)
    assignmentCount?: number;
}
