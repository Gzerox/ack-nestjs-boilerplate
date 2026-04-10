import { HttpStatus, applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocRequest,
    DocRequestFile,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { EnumDocRequestBodyType } from '@common/doc/enums/doc.enum';
import { FileSingleDto } from '@common/file/dtos/file.single.dto';
import { TripCreateDraftResponseDto } from '@modules/trip/dtos/response/trip.create-draft.response.dto';
import { TripFileAssetResponseDto } from '@modules/trip/dtos/response/trip-file-asset.response.dto';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripCreateDraftRequestDto } from '@modules/trip/dtos/request/trip.create-draft.request.dto';
import { TripUpdateDraftRequestDto } from '@modules/trip/dtos/request/trip.update-draft.request.dto';
import { TripMediaBatchUploadRequestDto } from '@modules/trip/dtos/request/trip-media-batch-upload.request.dto';
import { TripAttachmentBatchUploadRequestDto } from '@modules/trip/dtos/request/trip-attachment-batch-upload.request.dto';
import { TripMediaResponseDto } from '@modules/trip/dtos/response/trip-media.response.dto';
import { TripAttachmentResponseDto } from '@modules/trip/dtos/response/trip-attachment.response.dto';

const TripDocParamsIdTrip = [
    {
        name: 'idTrip',
        required: true,
        description: 'Trip identifier',
        type: String,
    },
];

export function TripSharedCreateDraftDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'create trip draft' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: TripCreateDraftRequestDto }),
        DocResponse<TripCreateDraftResponseDto>('trip.createDraft', {
            dto: TripCreateDraftResponseDto,
            httpStatus: HttpStatus.CREATED,
        })
    );
}

export function TripSharedUpdateDraftDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'update draft trip' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: TripUpdateDraftRequestDto }),
        DocResponse<TripResponseDto>('trip.update', { dto: TripResponseDto })
    );
}

export function TripSharedUploadIconDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'upload trip icon' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequestFile({
            dto: FileSingleDto,
            params: TripDocParamsIdTrip,
        }),
        DocResponse<TripFileAssetResponseDto>('trip.uploadIcon', {
            dto: TripFileAssetResponseDto,
        })
    );
}

export function TripSharedUploadCoverImageDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'upload trip cover image' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequestFile({
            dto: FileSingleDto,
            params: TripDocParamsIdTrip,
        }),
        DocResponse<TripFileAssetResponseDto>('trip.uploadCoverImage', {
            dto: TripFileAssetResponseDto,
        })
    );
}

export function TripSharedPublishDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'publish trip' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<TripResponseDto>('trip.publish', { dto: TripResponseDto })
    );
}

export function TripSharedUnpublishDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'unpublish trip' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<TripResponseDto>('trip.unpublish', { dto: TripResponseDto })
    );
}

export function TripSharedCancelDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'cancel trip' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse('trip.cancel')
    );
}

export function TripSharedArchiveDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'archive trip' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse('trip.archive')
    );
}

export function TripSharedGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get trip detail' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<TripResponseDto>('trip.get', { dto: TripResponseDto })
    );
}

export function TripSharedListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get trip list' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponsePaging<TripListItemResponseDto>('trip.list', { dto: TripListItemResponseDto })
    );
}

export function TripSharedRevokeInviteDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'revoke trip invite' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse('invite.revoke')
    );
}

export function TripSharedUploadMediaBatchDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'batch upload trip media' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequestFile({
            dto: TripMediaBatchUploadRequestDto,
            params: TripDocParamsIdTrip,
        }),
        DocResponse<TripMediaResponseDto>('trip.uploadMedia', {
            dto: TripMediaResponseDto,
            httpStatus: HttpStatus.CREATED,
        })
    );
}

export function TripSharedUploadAttachmentBatchDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'batch upload trip attachments' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequestFile({
            dto: TripAttachmentBatchUploadRequestDto,
            params: TripDocParamsIdTrip,
        }),
        DocResponse<TripAttachmentResponseDto>('trip.uploadAttachments', {
            dto: TripAttachmentResponseDto,
            httpStatus: HttpStatus.CREATED,
        })
    );
}
