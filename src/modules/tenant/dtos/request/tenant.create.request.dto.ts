import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class TenantCreateRequestDto {
    @ApiProperty({
        required: true,
        description: 'Tenant name',
        example: 'Acme Travel Group',
    })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({
        required: false,
        description: 'Tenant description',
        example: 'Primary workspace for the Acme travel team',
    })
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty()
    @MaxLength(300)
    description?: string;
}
