import { ApiProperty } from '@nestjs/swagger';
import { EnumTenantMemberRole } from '@generated/prisma-client';
import { IsEnum, IsNotEmpty, MaxLength } from 'class-validator';
import { IsCustomEmail } from '@common/request/validations/request.custom-email.validation';
import { Transform } from 'class-transformer';

export class TenantMemberInviteCreateRequestDto {
    @ApiProperty({
        required: true,
        description: 'Email address to invite',
    })
    @IsCustomEmail()
    @IsNotEmpty()
    @MaxLength(100)
    @Transform(({ value }) => value.toLowerCase().trim())
    email: Lowercase<string>;

    @ApiProperty({
        required: true,
        description: 'Tenant role for the member',
        enum: EnumTenantMemberRole,
    })
    @IsNotEmpty()
    @IsEnum(EnumTenantMemberRole)
    role: EnumTenantMemberRole;
}
