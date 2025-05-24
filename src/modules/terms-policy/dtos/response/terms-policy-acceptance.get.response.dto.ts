import { DatabaseDto } from '@common/database/dtos/database.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class TermsPolicyAcceptanceGetResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'Terms or policyId that was accepted',
        required: true,
    })
    @Expose()
    readonly termsPolicy: string;

    @ApiProperty({
        description: 'Date when the terms or policy was accepted',
        example: '2023-01-01T00:00:00.000Z',
        required: true,
    })
    @Expose()
    readonly acceptedAt: Date;
}
