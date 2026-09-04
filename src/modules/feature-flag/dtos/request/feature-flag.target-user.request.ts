import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class FeatureFlagTargetUserRequestDto {
    @ApiProperty({
        description: 'Target user identifier',
        example: '00000000-0000-4000-8000-000000000000',
    })
    @IsNotEmpty()
    @IsUUID()
    userId: string;
}
