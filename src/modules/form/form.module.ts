import { Module } from '@nestjs/common';
import { FormService } from './services/form.service';
import { FormRepository } from './repositories/form.repository';
import { FormAssignmentRepository } from './repositories/form-assignment.repository';
import { FormResponseRepository } from './repositories/form-response.repository';
import { FormUtil } from './utils/form.util';

@Module({
    imports: [],
    exports: [
        FormService,
        FormRepository,
        FormAssignmentRepository,
        FormResponseRepository,
        FormUtil,
    ],
    providers: [
        FormService,
        FormRepository,
        FormAssignmentRepository,
        FormResponseRepository,
        FormUtil,
    ],
    controllers: [],
})
export class FormModule {}
