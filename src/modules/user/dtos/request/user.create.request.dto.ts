import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from 'class-validator';
import { IsCustomEmail } from '@common/request/validations/request.custom-email.validation';
import { Transform } from 'class-transformer';

export class UserCreateRequestDto {
    @ApiProperty({
        example: faker.internet.email(),
        required: true,
        maxLength: 100,
    })
    @IsCustomEmail()
    @IsNotEmpty()
    @MaxLength(100)
    @Transform(({ value }) => value.toLowerCase().trim())
    email: Lowercase<string>;

    @ApiProperty({
        example: faker.string.uuid(),
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    roleId: string;

    @ApiProperty({
        example: faker.person.fullName(),
        required: false,
        maxLength: 100,
        minLength: 1,
    })
    @IsString()
    @IsOptional()
    @MinLength(1)
    @MaxLength(100)
    name?: string;

    @ApiProperty({
        example: faker.string.uuid(),
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    countryId: string;
}
