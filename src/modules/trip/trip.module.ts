import { Module } from '@nestjs/common';
import { AwsModule } from '@common/aws/aws.module';
import { TransportModule } from '@modules/transport/transport.module';
import { TenantContactModule } from '@modules/tenant-contact/tenant-contact.module';
import { TripRepository } from '@modules/trip/repositories/trip.repository';
import { TripCalendarEventRepository } from '@modules/trip/repositories/trip-calendar-event.repository';
import { TripTravelerRepository } from '@modules/trip/repositories/trip-traveler.repository';
import { TripInviteRepository } from '@modules/trip/repositories/trip-invite.repository';
import { TripAssetRepository } from '@modules/trip/repositories/trip-asset.repository';
import { TripService } from '@modules/trip/services/trip.service';
import { TripTravelerService } from '@modules/trip/services/trip-traveler.service';
import { TripUtil } from '@modules/trip/utils/trip.util';

@Module({
    imports: [AwsModule, TransportModule, TenantContactModule],
    providers: [
        TripService,
        TripRepository,
        TripCalendarEventRepository,
        TripTravelerRepository,
        TripInviteRepository,
        TripAssetRepository,
        TripUtil,
        TripTravelerService,
    ],
    exports: [TripService, TripTravelerService, TripRepository],
    controllers: [],
})
export class TripModule {}
