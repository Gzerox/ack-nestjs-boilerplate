import { HttpStatus, applyDecorators } from '@nestjs/common';
import { Doc, DocAuth, DocRequest, DocResponse } from '@common/doc/decorators/doc.decorator';
import { EnumDocRequestBodyType } from '@common/doc/enums/doc.enum';
import { TripInviteAcceptRequestDto } from '@modules/trip/dtos/request/trip-invite.accept.request.dto';

export function TripInviteUserAcceptDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'accept trip invite' }),
        DocAuth({ jwtAccessToken: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: TripInviteAcceptRequestDto }),
        DocResponse('invite.accept', { httpStatus: HttpStatus.OK })
    );
}
