import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ENUM_TERMS_POLICY_TYPE } from '@modules/terms-policy/enums/terms-policy.enum';

export class TermsPolicyGetRequestDto {
    @ApiProperty({
        enum: ENUM_TERMS_POLICY_TYPE,
        required: true,
        description: 'The type of policy to retrieve',
    })
    @IsEnum(ENUM_TERMS_POLICY_TYPE)
    type: ENUM_TERMS_POLICY_TYPE;
}
