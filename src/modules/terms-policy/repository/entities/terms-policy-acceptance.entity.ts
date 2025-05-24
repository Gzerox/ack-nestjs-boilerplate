import { Prop, Schema } from '@nestjs/mongoose';
import { TermsPolicyEntity } from '@modules/terms-policy/repository/entities/terms-policy.entity';
import { IDatabaseDocument } from '@common/database/interfaces/database.interface';
import { DatabaseSchema } from '@common/database/decorators/database.decorator';
import { UserEntity } from '@modules/user/repository/entities/user.entity';
import { DatabaseEntityBase } from '@common/database/bases/database.entity';

const TermsPolicyAcceptanceCollectionName = 'terms_policy_acceptance';

@Schema({
    collection: TermsPolicyAcceptanceCollectionName,
    timestamps: false,
    _id: false,
})
export class TermsPolicyAcceptanceEntity extends DatabaseEntityBase {
    @Prop({ ref: UserEntity.name, required: true, index: true })
    user: string;

    @Prop({ ref: TermsPolicyEntity.name, required: true, index: true })
    termsPolicy: string;

    @Prop({ required: true, type: Date })
    acceptedAt: Date;
}

export type TermsPolicyAcceptanceDoc =
    IDatabaseDocument<TermsPolicyAcceptanceEntity>;
export const TermsPolicyAcceptanceSchema = DatabaseSchema(
    TermsPolicyAcceptanceEntity
);

TermsPolicyAcceptanceSchema.index(
    { user: 1, termsPolicy: 1 },
    { unique: true }
);
