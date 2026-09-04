import { UserListResponseDto } from '@modules/user/dtos/response/user.list.response.dto';
import { IUserExport } from '@modules/user/interfaces/user.interface';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class UserExportResponseDto extends OmitType(UserListResponseDto, [
    'role',
    'photo',
    'termsOfServiceAccepted',
    'privacyAccepted',
    'cookiesAccepted',
    'marketingAccepted',
]) {
    @ApiProperty({
        required: true,
        description: 'User photo URL',
        example: 'https://example.com/photo.jpg',
    })
    @Expose()
    @Transform(({ obj }: { obj: IUserExport }) => obj.photo?.completedUrl ?? '')
    photo: string;

    @ApiProperty({
        required: true,
        description: 'Term of service flag',
        example: true,
    })
    @Expose()
    termsOfServiceAccepted: boolean;

    @ApiProperty({
        required: true,
        description: 'Privacy flag',
        example: true,
    })
    @Expose()
    privacyAccepted: boolean;

    @ApiProperty({
        required: true,
        description: 'Cookies flag',
        example: true,
    })
    @Expose()
    cookiesAccepted: boolean;

    @ApiProperty({
        required: true,
        description: 'Marketing flag',
        example: true,
    })
    @Expose()
    marketingAccepted: boolean;

    @ApiProperty({
        required: true,
        description: 'User role',
        example: 'admin',
    })
    @Expose()
    @Transform(({ obj }: { obj: IUserExport }) => obj.role.name)
    role: string;
}
