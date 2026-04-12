import {
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { HelperService } from '@common/helper/services/helper.service';
import { AirportRepository } from '@modules/transport/airport/repositories/airport.repository';
import { CreateItineraryRequestDto } from '@modules/transport/itinerary/dtos/request/create-itinerary.request.dto';
import { ItineraryWithSegmentsResponseDto } from '@modules/transport/itinerary/dtos/response/itinerary-with-segments.response.dto';
import { EnumItineraryStatusCodeError } from '@modules/transport/itinerary/enums/itinerary-status-code.enum';
import {
    ArriveAtBeforeDepartAtException,
    DepartAirportSameAsArriveException,
    SegmentChronologyException,
} from '@modules/transport/itinerary/exceptions/itinerary.exception';
import { ITransportFlightSegment } from '@modules/transport/itinerary/interfaces/itinerary.interface';
import { IItineraryService } from '@modules/transport/itinerary/interfaces/itinerary.service.interface';
import { ItineraryRepository } from '@modules/transport/itinerary/repositories/itinerary.repository';
import { ItineraryUtil } from '@modules/transport/itinerary/utils/itinerary.util';
import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';

@Injectable()
export class ItineraryService implements IItineraryService {
    private readonly logger = new Logger(ItineraryService.name);

    constructor(
        private readonly itineraryRepository: ItineraryRepository,
        private readonly airportRepository: AirportRepository,
        private readonly itineraryUtil: ItineraryUtil,
        private readonly helperService: HelperService
    ) {}

    async getOne(
        id: string
    ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
        const itinerary =
            await this.itineraryRepository.findOneWithSegments(id);

        if (!itinerary) {
            throw new NotFoundException({
                statusCode: EnumItineraryStatusCodeError.notFound,
                message: 'itinerary.error.notFound',
            });
        }

        return { data: this.itineraryUtil.mapOneWithSegments(itinerary) };
    }

    async create(
        dto: CreateItineraryRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
        // Validate trip exists
        const tripExists = await this.itineraryRepository.tripExists(dto.tripId);
        if (!tripExists) {
            throw new NotFoundException({
                statusCode: EnumItineraryStatusCodeError.notFound,
                message: 'itinerary.error.tripNotFound',
            });
        }

        const uniqueAirportIds = [
            ...new Set(
                dto.segments.flatMap(s => [
                    s.departAirportId,
                    s.arriveAirportId,
                ])
            ),
        ];

        const airports = await Promise.all(
            uniqueAirportIds.map(id => this.airportRepository.findOneById(id))
        );
        const airportMap = new Map(
            airports.map((a, i) => [uniqueAirportIds[i], a])
        );

        for (const id of uniqueAirportIds) {
            if (!airportMap.get(id)) {
                throw new BadRequestException(
                    'itinerary.error.airportNotFound'
                );
            }
        }

        const segments: ITransportFlightSegment[] = [];

        for (const seg of dto.segments) {
            if (seg.departAirportId === seg.arriveAirportId) {
                throw new DepartAirportSameAsArriveException();
            }

            const departAirport = airportMap.get(seg.departAirportId)!;
            const arriveAirport = airportMap.get(seg.arriveAirportId)!;

            const departAt = this.helperService.dateFromZoned(
                seg.departAt,
                departAirport.timezone
            );
            const arriveAt = this.helperService.dateFromZoned(
                seg.arriveAt,
                arriveAirport.timezone
            );

            if (arriveAt < departAt) {
                throw new ArriveAtBeforeDepartAtException();
            }

            segments.push({
                flightNumber: seg.flightNumber,
                airline: seg.airline ?? null,
                departAirportId: seg.departAirportId,
                arriveAirportId: seg.arriveAirportId,
                departAt,
                arriveAt,
                bookingRef: seg.bookingRef ?? null,
                notes: seg.notes ?? null,
            });
        }

        const timedSegments = segments.sort(
            (a, b) => a.departAt.getTime() - b.departAt.getTime()
        );

        for (let i = 1; i < timedSegments.length; i++) {
            const prev = timedSegments[i - 1];
            const curr = timedSegments[i];

            if (curr.departAt < prev.arriveAt) {
                throw new SegmentChronologyException(
                    `Segment departing ${curr.departAt.toISOString()} departs before previous segment arrives`
                );
            }
        }

        try {
            const created = await this.itineraryRepository.createWithSegments(
                {
                    name: dto.name,
                    direction: dto.direction,
                    tripId: dto.tripId,
                },
                segments,
                createdBy
            );

            return { data: this.itineraryUtil.mapOneWithSegments(created) };
        } catch (error) {
            this.logger.error(error, 'Failed to create itinerary');
            throw new InternalServerErrorException({
                message: 'itinerary.error.createFailed',
                _error: error
            });
        }
    }
}
