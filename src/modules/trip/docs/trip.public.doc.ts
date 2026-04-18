import { HttpStatus, applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocRequest,
    DocResponse,
} from '@common/doc/decorators/doc.decorator';
import { EnumDocRequestBodyType } from '@common/doc/enums/doc.enum';
import { TripInviteIdentifyRequestDto } from '@modules/trip/dtos/request/trip-invite-identify.request.dto';
import { TripInviteIdentifyResponseDto } from '@modules/trip/dtos/response/trip-invite-identify.response.dto';
import { TripPublicResponseDto } from '@modules/trip/dtos/response/trip-public.response.dto';

const TripPublicDocParamsTripSlug = [
    {
        name: 'tripSlug',
        required: true,
        description: 'Trip slug',
        type: String,
    },
];

export function TripPublicGetBySlugDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get public trip summary by slug' }),
        DocRequest({ params: TripPublicDocParamsTripSlug }),
        DocAuth({ xApiKey: true }),
        DocResponse<TripPublicResponseDto>('trip.get', {
            dto: TripPublicResponseDto,
            httpStatus: HttpStatus.OK,
        })
    );
}

export function TripPublicCheckInviteDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'check invite auth step by trip slug and email' }),
        DocRequest({
            params: TripPublicDocParamsTripSlug,
            bodyType: EnumDocRequestBodyType.json,
            dto: TripInviteIdentifyRequestDto,
        }),
        DocAuth({ xApiKey: true }),
        DocResponse<TripInviteIdentifyResponseDto>('invite.check', {
            dto: TripInviteIdentifyResponseDto,
            httpStatus: HttpStatus.OK,
        })
    );
}
