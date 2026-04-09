import { DatabaseDto } from '@common/database/dtos/database.dto';
import { ApiProperty } from '@nestjs/swagger';
import { EnumUserStatus } from '@generated/prisma-client';

export class TermPolicyAcceptanceUserResponseDto extends DatabaseDto {
    @ApiProperty({
        required: false,
        maxLength: 100,
        minLength: 1,
    })
    readonly name?: string;

    @ApiProperty({
        required: true,
        maxLength: 50,
        minLength: 3,
    })
    readonly username: string;

    @ApiProperty({
        required: true,
        example: true,
    })
    readonly isVerified: boolean;

    @ApiProperty({
        required: true,
        example: 'user@example.com',
    })
    readonly email: string;

    @ApiProperty({
        required: true,
        enum: EnumUserStatus,
        example: EnumUserStatus.active,
    })
    readonly status: EnumUserStatus;
}
