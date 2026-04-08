import { ApiProperty } from '@nestjs/swagger';
import { faker } from '@faker-js/faker';
import { DatabaseDto } from '@common/database/dtos/database.dto';

export class TripTravelerUserResponseDto {
    @ApiProperty({
        description: 'User identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    id: string;

    @ApiProperty({
        description: 'User full name',
        example: faker.person.fullName(),
        required: false,
        nullable: true,
    })
    name: string | null;

    @ApiProperty({
        description: 'Username',
        example: faker.internet.username(),
        required: true,
    })
    username: string;

    @ApiProperty({
        description: 'Email address',
        example: faker.internet.email(),
        required: true,
    })
    email: string;
}

export class TripTravelerListItemResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'Trip identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    tripId: string;

    @ApiProperty({
        description: 'User identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    userId: string;

    @ApiProperty({
        description: 'Traveler group identifier',
        example: faker.database.mongodbObjectId(),
        required: false,
        nullable: true,
    })
    groupId: string | null;

    @ApiProperty({
        description: 'User details',
        type: () => TripTravelerUserResponseDto,
        required: true,
    })
    user: TripTravelerUserResponseDto;
}
