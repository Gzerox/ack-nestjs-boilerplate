import { Module } from '@nestjs/common';
import { TripFormService } from '@modules/trip-form/services/trip-form.service';
import { TripFormRepository } from '@modules/trip-form/repositories/trip-form.repository';
import { TripFormAssignmentRepository } from '@modules/trip-form/repositories/trip-form-assignment.repository';
import { TripFormUtil } from '@modules/trip-form/utils/trip-form.util';
import { TripFormExportUtil } from '@modules/trip-form/utils/trip-form-export.util';

@Module({
    imports: [],
    exports: [
        TripFormService,
        TripFormRepository,
        TripFormAssignmentRepository,
        TripFormUtil,
        TripFormExportUtil,
    ],
    providers: [
        TripFormService,
        TripFormRepository,
        TripFormAssignmentRepository,
        TripFormUtil,
        TripFormExportUtil,
    ],
    controllers: [],
})
export class TripFormModule {}
