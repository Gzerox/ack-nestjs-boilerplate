import { ApiProperty } from '@nestjs/swagger';
import {
    EnumTenantMemberRole,
    EnumTenantMemberStatus,
} from '@generated/prisma-client';
import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
} from 'class-validator';

export class TenantMemberUpdateRequestDto {
    @ApiProperty({
        required: false,
        description: 'Tenant role',
        enum: EnumTenantMemberRole,
    })
    @IsOptional()
    @IsEnum(EnumTenantMemberRole)
    @IsNotEmpty()
    role?: EnumTenantMemberRole;

    @ApiProperty({
        required: false,
        description: 'Tenant member status',
        enum: EnumTenantMemberStatus,
    })
    @IsOptional()
    @IsEnum(EnumTenantMemberStatus)
    status?: EnumTenantMemberStatus;
}
