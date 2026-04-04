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
import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma-client';
import { CreateItineraryRequestDto } from '../dtos/request/create-itinerary.request.dto';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';
import {
    AirportNotFoundBadRequestException,
    ArriveAtBeforeDepartAtException,
    DepartAirportSameAsArriveException,
    ItineraryNotFoundException,
    SegmentChronologyException,
} from '../exceptions/itinerary.exception';
import { IItineraryService } from '../interfaces/itinerary.service.interface';
import { ItineraryRepository } from '../repositories/itinerary.repository';
import { ItineraryUtil } from '../utils/itinerary.util';

@Injectable()
export class ItineraryService implements IItineraryService {
    constructor(
        private readonly itineraryRepository: ItineraryRepository,
        private readonly airportRepository: AirportRepository,
        private readonly itineraryUtil: ItineraryUtil,
        private readonly helperService: HelperService,
    ) {}

    async getListOffset(
        pagination: IPaginationQueryOffsetParams<
            Prisma.TransportItinerarySelect,
            Prisma.TransportItineraryWhereInput
        >,
        direction?: Record<string, IPaginationIn>,
    ): Promise<IResponsePagingReturn<ItineraryResponseDto>> {
        const { data, ...others } = await this.itineraryRepository.findWithPaginationOffset(
            pagination,
            direction,
        );

        return {
            data: this.itineraryUtil.mapList(data),
            ...others,
        };
    }

    async getOne(id: string): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
        const itinerary = await this.itineraryRepository.findOneWithSegments(id);

        if (!itinerary) {
            throw new ItineraryNotFoundException(id);
        }

        return { data: this.itineraryUtil.mapOneWithSegments(itinerary) };
    }

    async create(
        dto: CreateItineraryRequestDto,
        createdBy: string,
    ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
        const uniqueAirportIds = [
            ...new Set(dto.segments.flatMap((s) => [s.departAirportId, s.arriveAirportId])),
        ];

        const airports = await Promise.all(
            uniqueAirportIds.map((id) => this.airportRepository.findOneById(id)),
        );
        const airportMap = new Map(airports.map((a, i) => [uniqueAirportIds[i], a]));

        for (const id of uniqueAirportIds) {
            if (!airportMap.get(id)) {
                throw new AirportNotFoundBadRequestException(id);
            }
        }

        const convertedSegments: Prisma.TransportFlightSegmentCreateWithoutItineraryInput[] = [];

        for (const seg of dto.segments) {
            if (seg.departAirportId === seg.arriveAirportId) {
                throw new DepartAirportSameAsArriveException();
            }

            const departAirport = airportMap.get(seg.departAirportId)!;
            const arriveAirport = airportMap.get(seg.arriveAirportId)!;

            const departAt = seg.departAt
                ? this.helperService.dateFromZoned(seg.departAt, departAirport.timezone)
                : null;
            const arriveAt = seg.arriveAt
                ? this.helperService.dateFromZoned(seg.arriveAt, arriveAirport.timezone)
                : null;

            if (departAt && arriveAt && arriveAt < departAt) {
                throw new ArriveAtBeforeDepartAtException();
            }

            convertedSegments.push({
                flightNumber: seg.flightNumber,
                airline: seg.airline ?? null,
                departAirport: { connect: { id: seg.departAirportId } },
                arriveAirport: { connect: { id: seg.arriveAirportId } },
                departAt,
                arriveAt,
                bookingRef: seg.bookingRef ?? null,
                notes: seg.notes ?? null,
                createdBy,
            });
        }

        const timedSegments = convertedSegments
            .filter((s) => s.departAt != null)
            .sort((a, b) => (a.departAt as Date).getTime() - (b.departAt as Date).getTime());

        for (let i = 1; i < timedSegments.length; i++) {
            const prev = timedSegments[i - 1];
            const curr = timedSegments[i];
            if (prev.arriveAt && curr.departAt && (curr.departAt as Date) < (prev.arriveAt as Date)) {
                throw new SegmentChronologyException(
                    `Segment departing ${(curr.departAt as Date).toISOString()} departs before previous segment arrives`,
                );
            }
        }

        const created = await this.itineraryRepository.createWithSegments({
            name: dto.name,
            direction: dto.direction,
            createdBy,
            segments: { create: convertedSegments },
        });

        return { data: this.itineraryUtil.mapOneWithSegments(created) };
    }
}
