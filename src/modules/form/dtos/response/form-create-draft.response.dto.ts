import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';

export class FormCreateDraftResponseDto {
    @ApiProperty({ description: 'Created form identifier', example: faker.database.mongodbObjectId(), required: true })
    id: string;
}
