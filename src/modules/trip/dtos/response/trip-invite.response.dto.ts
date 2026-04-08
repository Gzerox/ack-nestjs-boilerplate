import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { DatabaseDto } from '@common/database/dtos/database.dto';
import { TripInviteStatus } from '@generated/prisma-client';

export class TripInviteResponseDto extends DatabaseDto {
    @ApiProperty({ example: faker.internet.email(), required: true })
    email: string;

    @ApiProperty({ enum: TripInviteStatus, required: true })
    status: TripInviteStatus;

    @ApiProperty({ example: faker.date.recent(), required: false, nullable: true })
    acceptedAt: Date | null;

    @ApiProperty({ example: faker.date.future(), required: false, nullable: true })
    expiresAt: Date | null;

    @ApiProperty({ example: faker.date.recent(), required: false, nullable: true })
    revokedAt: Date | null;

    @ApiProperty({ required: false, nullable: true })
    revokedBy: string | null;
}
