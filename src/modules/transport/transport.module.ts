import { AirportRepository } from '@modules/transport/airport/repositories/airport.repository';
import { AirportService } from '@modules/transport/airport/services/airport.service';
import { AirportUtil } from '@modules/transport/airport/utils/airport.util';
import { ItineraryRepository } from '@modules/transport/itinerary/repositories/itinerary.repository';
import { ItineraryService } from '@modules/transport/itinerary/services/itinerary.service';
import { ItineraryUtil } from '@modules/transport/itinerary/utils/itinerary.util';
import { Module } from '@nestjs/common';

@Module({
    imports: [],
    providers: [
        AirportService,
        AirportRepository,
        AirportUtil,
        ItineraryService,
        ItineraryRepository,
        ItineraryUtil,
    ],
    exports: [
        AirportService,
        AirportRepository,
        AirportUtil,
        ItineraryService,
        ItineraryRepository,
        ItineraryUtil,
    ],
    controllers: [],
})
export class TransportModule {}
