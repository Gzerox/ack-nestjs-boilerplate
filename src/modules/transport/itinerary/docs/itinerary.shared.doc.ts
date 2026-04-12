import { applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocResponse,
} from '@common/doc/decorators/doc.decorator';
import {
    ItineraryMaxSegments,
} from '@modules/transport/itinerary/constants/itinerary.list.constant';
import { ItineraryWithSegmentsResponseDto } from '@modules/transport/itinerary/dtos/response/itinerary-with-segments.response.dto';

export function ItinerarySharedGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'Get itinerary details with segments',
            description:
                'Retrieve a complete itinerary record including all flight segments with airport details.',
        }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<ItineraryWithSegmentsResponseDto>('itinerary.get', {
            dto: ItineraryWithSegmentsResponseDto,
        })
    );
}

export function ItinerarySharedCreateDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'Create an itinerary with segments',
            description: `Create a flight itinerary with up to ${ItineraryMaxSegments} flight segments. Departure and arrival times are required, accepted in the local airport timezone, and stored as UTC.`,
        }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<ItineraryWithSegmentsResponseDto>('itinerary.create', {
            dto: ItineraryWithSegmentsResponseDto,
            httpStatus: 201,
        })
    );
}
