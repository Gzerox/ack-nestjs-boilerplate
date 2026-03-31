import { AirportRepository } from '@modules/transport/airport/repositories/airport.repository';
import { AirportService } from '@modules/transport/airport/services/airport.service';
import { AirportUtil } from '@modules/transport/airport/utils/airport.util';
import { Module } from '@nestjs/common';

@Module({
    imports: [],
    exports: [AirportService, AirportRepository, AirportUtil],
    providers: [AirportService, AirportRepository, AirportUtil],
    controllers: [],
})
export class TransportModule {}
