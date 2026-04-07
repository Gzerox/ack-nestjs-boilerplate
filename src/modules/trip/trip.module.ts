import { Module } from '@nestjs/common';
import { FormModule } from '@modules/form/form.module';
import { TripRepository } from '@modules/trip/repositories/trip.repository';
import { TripCalendarEventRepository } from '@modules/trip/repositories/trip-calendar-event.repository';
import { TripService } from '@modules/trip/services/trip.service';
import { AwsModule } from '@common/aws/aws.module';

@Module({
    imports: [FormModule, AwsModule],
    providers: [TripService, TripRepository, TripCalendarEventRepository],
    exports: [TripService],
    controllers: [],
})
export class TripModule {}
