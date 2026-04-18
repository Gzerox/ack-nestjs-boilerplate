import { HttpStatus, applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocResponse,
} from '@common/doc/decorators/doc.decorator';
import { TripPublicResponseDto } from '@modules/trip/dtos/response/trip-public.response.dto';

export function TripPublicGetBySlugDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get public trip summary by slug' }),
        DocAuth({ xApiKey: true }),
        DocResponse<TripPublicResponseDto>('trip.get', {
            dto: TripPublicResponseDto,
            httpStatus: HttpStatus.OK,
        })
    );
}
