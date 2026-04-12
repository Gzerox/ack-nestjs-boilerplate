import {
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { CreateItineraryRequestDto } from '@modules/transport/itinerary/dtos/request/create-itinerary.request.dto';
import { ItineraryWithSegmentsResponseDto } from '@modules/transport/itinerary/dtos/response/itinerary-with-segments.response.dto';

export interface IItineraryService {
    getOne(
        id: string
    ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>>;

    create(
        dto: CreateItineraryRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>>;
}
