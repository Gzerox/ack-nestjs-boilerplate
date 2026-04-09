import { Module } from '@nestjs/common';
import { FormModule } from '@modules/form/form.module';
import { AwsModule } from '@common/aws/aws.module';
import { TripRepository } from '@modules/trip/repositories/trip.repository';
import { TripCalendarEventRepository } from '@modules/trip/repositories/trip-calendar-event.repository';
import { TripTravelerRepository } from '@modules/trip/repositories/trip-traveler.repository';
import { TripInviteRepository } from '@modules/trip/repositories/trip-invite.repository';
import { TripContactRepository } from '@modules/trip/repositories/trip-contact.repository';
import { TenantContactRepository } from '@modules/trip/repositories/tenant-contact.repository';
import { TripService } from '@modules/trip/services/trip.service';
import { TripTravelerService } from '@modules/trip/services/trip-traveler.service';
import { TripUtil } from '@modules/trip/utils/trip.util';

@Module({
    imports: [FormModule, AwsModule],
    providers: [
        TripService,
        TripRepository,
        TripCalendarEventRepository,
        TripTravelerRepository,
        TripInviteRepository,
        TripContactRepository,
        TenantContactRepository,
        TripUtil,
        TripTravelerService,
    ],
    exports: [TripService, TripTravelerService],
    controllers: [],
})
export class TripModule {}
