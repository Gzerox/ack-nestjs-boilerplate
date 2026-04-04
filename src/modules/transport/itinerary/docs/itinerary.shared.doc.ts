import { applyDecorators } from '@nestjs/common';
import { Doc, DocAuth, DocResponse, DocResponsePaging } from '@common/doc/decorators/doc.decorator';
import { ItineraryDefaultAvailableSearch } from '../constants/itinerary.list.constant';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';

export function ItinerarySharedListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'Get list of itineraries',
            description:
                'Retrieve a paginated list of flight itineraries with optional filtering by direction.',
        }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponsePaging<ItineraryResponseDto>('itinerary.list', {
            dto: ItineraryResponseDto,
            availableSearch: ItineraryDefaultAvailableSearch,
        }),
    );
}

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
        }),
    );
}

export function ItinerarySharedCreateDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'Create an itinerary with segments',
            description:
                'Create a flight itinerary with one or more flight segments. Departure/arrival times are accepted in the local airport timezone and stored as UTC.',
        }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<ItineraryWithSegmentsResponseDto>('itinerary.create', {
            dto: ItineraryWithSegmentsResponseDto,
            httpStatus: 201,
        }),
    );
}
