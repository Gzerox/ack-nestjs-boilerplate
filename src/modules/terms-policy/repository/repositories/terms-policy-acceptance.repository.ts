import { Injectable } from '@nestjs/common';
import { DatabaseRepositoryBase } from '@common/database/bases/database.repository';
import { InjectDatabaseModel } from '@common/database/decorators/database.decorator';
import { Model } from 'mongoose';
import { UserEntity } from '@modules/user/repository/entities/user.entity';
import {
    TermsPolicyAcceptanceDoc,
    TermsPolicyAcceptanceEntity,
} from '@modules/terms-policy/repository/entities/terms-policy-acceptance.entity';

@Injectable()
export class TermsPolicyAcceptanceRepository extends DatabaseRepositoryBase<
    TermsPolicyAcceptanceEntity,
    TermsPolicyAcceptanceDoc
> {
    constructor(
        @InjectDatabaseModel(TermsPolicyAcceptanceEntity.name)
        private readonly termsPolicyAcceptanceModel: Model<TermsPolicyAcceptanceEntity>
    ) {
        super(termsPolicyAcceptanceModel, {
            path: 'user',
            localField: 'user',
            foreignField: '_id',
            model: UserEntity.name,
            justOne: true,
        });
    }
}