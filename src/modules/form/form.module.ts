import { Module } from '@nestjs/common';
import { FormService } from '@modules/form/services/form.service';
import { FormRepository } from '@modules/form/repositories/form.repository';
import { FormAssignmentRepository } from '@modules/form/repositories/form-assignment.repository';
import { FormUtil } from '@modules/form/utils/form.util';

@Module({
    imports: [],
    exports: [
        FormService,
        FormRepository,
        FormAssignmentRepository,
        FormUtil,
    ],
    providers: [
        FormService,
        FormRepository,
        FormAssignmentRepository,
        FormUtil,
    ],
    controllers: [],
})
export class FormModule {}
