import { ApiProperty } from '@nestjs/swagger';
import { EnumTenantMemberRole } from '@generated/prisma-client';
import { IsEnum, IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class TenantMemberCreateRequestDto {
    @ApiProperty({
        required: true,
        description: 'User id',
    })
    @IsString()
    @IsNotEmpty()
    @IsMongoId()
    userId: string;

    @ApiProperty({
        required: true,
        description: 'Tenant role',
        enum: EnumTenantMemberRole,
    })
    @IsEnum(EnumTenantMemberRole)
    @IsNotEmpty()
    role: EnumTenantMemberRole;
}
