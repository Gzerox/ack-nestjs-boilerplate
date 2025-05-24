import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ENUM_TERMS_POLICY_TYPE } from '@modules/terms-policy/enums/terms-policy.enum';
import { ENUM_MESSAGE_LANGUAGE } from '@common/message/enums/message.enum';
import { Types } from 'mongoose';

export class TermsPolicyGetResponseDto {
    @Expose()
    _id: Types.ObjectId;

    @ApiProperty({
        description: 'Type of terms or policy',
        enum: ENUM_TERMS_POLICY_TYPE,
        example: ENUM_TERMS_POLICY_TYPE.TERMS,
        required: true,
    })
    @Expose()
    readonly type: ENUM_TERMS_POLICY_TYPE;

    @ApiProperty({
        description: 'Title of the terms or policy',
        example: 'Terms of Service',
        required: true,
    })
    @Expose()
    readonly title: string;

    @ApiProperty({
        description: 'Brief description of the terms or policy',
        example: 'Legal terms governing the use of our services',
        required: true,
    })
    @Expose()
    readonly description: string;

    @ApiProperty({
        description: 'Full content of the terms or policy',
        example: 'These Terms of Service govern your use of our platform...',
        required: true,
    })
    @Expose()
    readonly content: string;

    @ApiProperty({
        description: 'Language of the terms or policy',
        enum: ENUM_MESSAGE_LANGUAGE,
        example: 'en',
        required: true,
    })
    @Expose()
    readonly language: ENUM_MESSAGE_LANGUAGE;

    @ApiProperty({
        description: 'Whether the terms or policy is published',
        example: true,
        required: true,
    })
    @Expose()
    readonly isPublished: boolean;

    @ApiProperty({
        description: 'Date when the terms or policy was published',
        example: '2023-01-01T00:00:00.000Z',
        required: false,
        nullable: true,
    })
    @Expose()
    readonly publishedAt?: Date;
}
