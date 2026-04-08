import { Module } from '@nestjs/common';
import { FormModule } from '@modules/form/form.module';
import { AwsModule } from '@common/aws/aws.module';
import { TripRepository } from '@modules/trip/repositories/trip.repository';
import { TripCalendarEventRepository } from '@modules/trip/repositories/trip-calendar-event.repository';
import { TripTravelerRepository } from '@modules/trip/repositories/trip-traveler.repository';
import { TripService } from '@modules/trip/services/trip.service';
import { TripTravelerService } from '@modules/trip/services/trip-traveler.service';

@Module({
    imports: [FormModule, AwsModule],
    providers: [TripService, TripRepository, TripCalendarEventRepository, TripTravelerRepository, TripTravelerService],
    exports: [TripService, TripTravelerService],
    controllers: [],
})
export class TripModule {}
