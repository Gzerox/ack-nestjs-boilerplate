import { DatabaseDto } from '@common/database/dtos/database.dto';
import { faker } from '@faker-js/faker';
import { TermPolicyAcceptanceUserResponseDto } from '@modules/term-policy/dtos/response/term-policy.acceptance-user.response.dto';
import { TermPolicyResponseDto } from '@modules/term-policy/dtos/response/term-policy.response.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class TermPolicyUserAcceptanceResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'Identifier of the user who accepted the terms or policy',
        example: faker.string.uuid(),
        required: true,
    })
    readonly userId: string;

    @ApiProperty({
        required: true,
        type: TermPolicyAcceptanceUserResponseDto,
    })
    @Type(() => TermPolicyAcceptanceUserResponseDto)
    readonly user: TermPolicyAcceptanceUserResponseDto;

    @ApiProperty({
        description: 'Identifier of the terms or policy accepted',
        example: faker.string.uuid(),
        required: true,
    })
    readonly termPolicyId: string;

    @ApiProperty({
        required: true,
        type: TermPolicyResponseDto,
    })
    @Type(() => TermPolicyResponseDto)
    readonly termPolicy: TermPolicyResponseDto;

    @ApiProperty({
        description: 'Date when the terms or policy was accepted',
        example: faker.date.recent(),
        required: true,
    })
    readonly acceptedAt: Date;
}
