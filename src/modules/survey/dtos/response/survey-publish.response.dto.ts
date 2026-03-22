import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';

export class SurveyPublishResponseDto {
    @ApiProperty({
        description: 'Created survey identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    id: string;
}
