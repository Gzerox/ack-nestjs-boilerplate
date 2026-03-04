import { ApiProperty } from '@nestjs/swagger';
import { EnumAssetAccess, EnumAssetStatus } from '@prisma/client';

export class AssetResponseDto {
    @ApiProperty({
        description: 'Unique identifier for the asset',
        example: '507f1f77bcf86cd799439011',
    })
    id: string;

    @ApiProperty({
        description: 'Original filename of the uploaded asset',
        example: 'my-document.pdf',
    })
    filename: string;

    @ApiProperty({
        description: 'MIME type of the asset',
        example: 'application/pdf',
    })
    mime: string;

    @ApiProperty({
        description: 'File extension of the asset',
        example: 'pdf',
    })
    extension: string;

    @ApiProperty({
        description: 'Size of the asset in bytes',
        example: 1024000,
    })
    size: number;

    @ApiProperty({
        enum: EnumAssetAccess,
        description: 'Access level of the asset (private or public)',
    })
    access: EnumAssetAccess;

    @ApiProperty({
        description: 'Complete URL to download the asset',
        example: 'https://s3.amazonaws.com/bucket/assets/file.pdf',
    })
    completedUrl: string;

    @ApiProperty({
        required: false,
        description: 'CDN URL for the asset (if configured)',
        example: 'https://cdn.example.com/assets/file.pdf',
    })
    cdnUrl?: string;

    @ApiProperty({
        enum: EnumAssetStatus,
        description: 'Current status of the asset (active or deleted)',
    })
    status: EnumAssetStatus;

    @ApiProperty({
        description: 'Timestamp when the asset was created',
        example: '2026-03-04T10:30:00Z',
    })
    createdAt: Date;
}
