import { ApiProperty } from '@nestjs/swagger';
import { IFile } from '@common/file/interfaces/file.interface';

export class TripAttachmentBatchUploadRequestDto {
    @ApiProperty({
        type: 'array',
        items: { type: 'string', format: 'binary' },
        description: 'Attachment files (PDF)',
    })
    files: IFile[];

    @ApiProperty({
        type: 'string',
        description:
            'JSON array of metadata, one item per file. Each item: { title: string, type: TripAttachmentType, displayName?: string }',
    })
    data: string;
}
