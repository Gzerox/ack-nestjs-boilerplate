import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
} from 'class-validator';

export class TenantContactCreateRequestDto {
    @ApiProperty({ example: 'Mario', required: true })
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({ example: 'Rossi', required: true })
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty({ example: 'Emergency', required: false })
    @IsString()
    @IsOptional()
    @MaxLength(80)
    category?: string;

    @ApiProperty({
        example: '+390612345678',
        description: 'Phone number in E.164 format (e.g. +390612345678)',
        required: false,
    })
    @IsString()
    @IsOptional()
    @Matches(/^\+[1-9]\d{1,14}$/, { message: 'phone must be in E.164 format' })
    phone?: string;

    @ApiProperty({ example: 'support@example.com', required: false })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiProperty({ example: 'Available 24/7', required: false })
    @IsString()
    @IsOptional()
    notes?: string;
}
