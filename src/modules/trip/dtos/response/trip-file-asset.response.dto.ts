import { ApiProperty } from '@nestjs/swagger';

export class TripFileAssetResponseDto {
    @ApiProperty({ description: 'S3 bucket name', required: true })
    bucket: string;

    @ApiProperty({ description: 'Object key/path', required: true })
    key: string;

    @ApiProperty({ description: 'Optional CDN URL', required: false })
    cdnUrl: string | null;

    @ApiProperty({ description: 'Final resolved read URL', required: true })
    completedUrl: string;

    @ApiProperty({ description: 'MIME type', required: true })
    mime: string;

    @ApiProperty({ description: 'File extension', required: true })
    extension: string;

    @ApiProperty({ description: 'Accessibility level', required: true })
    access: string;

    @ApiProperty({ description: 'Object size in bytes', required: true })
    size: number;
}
