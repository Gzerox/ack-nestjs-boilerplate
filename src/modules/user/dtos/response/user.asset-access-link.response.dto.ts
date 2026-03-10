import { ApiProperty } from '@nestjs/swagger';
import { EnumAssetAccess } from '@prisma/client';

export class UserAssetAccessLinkResponseDto {
    @ApiProperty({
        description: 'Unique identifier of the asset',
        example: '507f1f77bcf86cd799439011',
    })
    assetId: string;

    @ApiProperty({
        enum: EnumAssetAccess,
        example: EnumAssetAccess.private,
        description: 'Asset access level',
    })
    access: EnumAssetAccess;

    @ApiProperty({
        description: 'Reachable URL for this private asset',
        example:
            'https://example-bucket.s3.eu-west-1.amazonaws.com/assets/file.pdf?X-Amz-Signature=***',
    })
    accessibleUrl: string;

    @ApiProperty({
        required: false,
        description:
            'URL expiration time in seconds (present for presigned URLs)',
        example: 1800,
    })
    expiredIn?: number;
}
