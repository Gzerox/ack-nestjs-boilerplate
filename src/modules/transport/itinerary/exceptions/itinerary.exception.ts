import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EnumItineraryStatusCodeError } from '../enums/itinerary-status-code.enum';

export class ItineraryNotFoundException extends NotFoundException {
    constructor(itineraryId: string) {
        super({
            statusCode: EnumItineraryStatusCodeError.notFound,
            message: 'itinerary.error.notFound',
            messageProperties: { id: itineraryId },
            data: { itineraryId },
        });
    }
}

export class AirportNotFoundBadRequestException extends BadRequestException {
    constructor(airportId: string) {
        super({
            statusCode: EnumItineraryStatusCodeError.airportNotFound,
            message: 'itinerary.error.airportNotFound',
            messageProperties: { id: airportId },
            data: { airportId },
        });
    }
}

export class DepartAirportSameAsArriveException extends BadRequestException {
    constructor() {
        super({
            statusCode: EnumItineraryStatusCodeError.departAirportSameAsArrive,
            message: 'itinerary.error.departAirportSameAsArrive',
            data: {},
        });
    }
}

export class ArriveAtBeforeDepartAtException extends BadRequestException {
    constructor() {
        super({
            statusCode: EnumItineraryStatusCodeError.arriveAtBeforeDepartAt,
            message: 'itinerary.error.arriveAtBeforeDepartAt',
            data: {},
        });
    }
}

export class SegmentChronologyException extends BadRequestException {
    constructor(details: string) {
        super({
            statusCode: EnumItineraryStatusCodeError.segmentChronologyInvalid,
            message: 'itinerary.error.segmentChronologyInvalid',
            messageProperties: { details },
            data: { details },
        });
    }
}

export class AirportHasSegmentsException extends BadRequestException {
    constructor(airportId: string) {
        super({
            statusCode: EnumItineraryStatusCodeError.airportHasSegments,
            message: 'itinerary.error.airportHasSegments',
            messageProperties: { id: airportId },
            data: { airportId },
        });
    }
}
