import { ApiProperty } from '@nestjs/swagger';
import { IFile } from '@common/file/interfaces/file.interface';

export class TripMediaBatchUploadRequestDto {
    @ApiProperty({
        type: 'array',
        items: { type: 'string', format: 'binary' },
        description: 'Media files (images and videos)',
    })
    files: IFile[];

    @ApiProperty({
        type: 'string',
        description:
            'JSON array of metadata, one item per file. Each item: { kind: TripMediaKind, caption?: string, calendarEventId?: string }',
    })
    data: string;
}
