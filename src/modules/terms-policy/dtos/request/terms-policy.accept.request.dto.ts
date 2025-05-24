import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TermsPolicyAcceptRequestDto {
    @ApiProperty({
        required: true,
        description: 'PolicyId to accept',
    })
    @IsMongoId()
    policyId: string;
}
