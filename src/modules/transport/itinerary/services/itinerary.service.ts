import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { HelperService } from '@common/helper/services/helper.service';
import { AirportRepository } from '@modules/transport/airport/repositories/airport.repository';
import { CreateItineraryRequestDto } from '@modules/transport/itinerary/dtos/request/create-itinerary.request.dto';
import { ItineraryResponseDto } from '@modules/transport/itinerary/dtos/response/itinerary.response.dto';
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
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@generated/prisma-client';

@Injectable()
export class ItineraryService implements IItineraryService {
    constructor(
        private readonly itineraryRepository: ItineraryRepository,
        private readonly airportRepository: AirportRepository,
        private readonly itineraryUtil: ItineraryUtil,
        private readonly helperService: HelperService
    ) {}

    async getListOffset(
        pagination: IPaginationQueryOffsetParams<
            Prisma.TransportItinerarySelect,
            Prisma.TransportItineraryWhereInput
        >,
        direction?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<ItineraryResponseDto>> {
        const { data, ...others } =
            await this.itineraryRepository.findWithPaginationOffset(
                pagination,
                direction
            );

        return {
            data: this.itineraryUtil.mapList(data),
            ...others,
        };
    }

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

        const created = await this.itineraryRepository.createWithSegments(
            {
                name: dto.name,
                direction: dto.direction,
            },
            segments,
            createdBy
        );

        return { data: this.itineraryUtil.mapOneWithSegments(created) };
    }
}
