import { BadRequestException } from '@nestjs/common';
import { EnumItineraryStatusCodeError } from '@modules/transport/itinerary/enums/itinerary-status-code.enum';

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
