import { UserListResponseDto } from '@modules/user/dtos/response/user.list.response.dto';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class UserExportResponseDto extends OmitType(UserListResponseDto, [
    'role',
    'photo',
]) {
    @ApiProperty({
        required: true,
        description: 'User photo URL',
        example: 'https://example.com/photo.jpg',
    })
    @Expose()
    @Transform(({ obj }) => obj.photo.completedUrl)
    photo: string;

    @ApiProperty({
        required: true,
        description: 'Term of service flag',
        example: true,
    })
    @Expose()
    termPolicyTermsOfService: boolean;

    @ApiProperty({
        required: true,
        description: 'Privacy flag',
        example: true,
    })
    @Expose()
    termPolicyPrivacy: boolean;

    @ApiProperty({
        required: true,
        description: 'Cookies flag',
        example: true,
    })
    @Expose()
    termPolicyCookies: boolean;

    @ApiProperty({
        required: true,
        description: 'Marketing flag',
        example: true,
    })
    @Expose()
    termPolicyMarketing: boolean;

    @ApiProperty({
        required: true,
        description: 'User role',
        example: 'admin',
    })
    @Expose()
    @Transform(({ obj }) => obj.role.name)
    role: string;
}
