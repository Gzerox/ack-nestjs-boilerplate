import { Injectable } from '@nestjs/common';
import { DatabaseRepositoryBase } from '@common/database/bases/database.repository';
import { InjectDatabaseModel } from '@common/database/decorators/database.decorator';
import { Model } from 'mongoose';
import {
    TermsPolicyDoc,
    TermsPolicyEntity,
} from '@modules/terms-policy/repository/entities/terms-policy.entity';

@Injectable()
export class TermsPolicyRepository extends DatabaseRepositoryBase<
    TermsPolicyEntity,
    TermsPolicyDoc
> {
    constructor(
        @InjectDatabaseModel(TermsPolicyEntity.name)
        private readonly termsPolicyModel: Model<TermsPolicyEntity>
    ) {
        super(termsPolicyModel);
    }
}