import { IsCustomEmail } from '@common/request/validations/request.custom-email.validation';
import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsNotEmpty,
    IsString,
} from 'class-validator';

export class TripInviteIdentifyRequestDto {
    @ApiProperty({
        description: 'Invitee email to identify the next auth step',
        example: faker.internet.email(),
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    @IsCustomEmail()
    @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
    email: string;
}
