import { DatabaseEntityBase } from '@common/database/bases/database.entity';
import {
    DatabaseEntity,
    DatabaseProp,
    DatabaseSchema,
} from '@common/database/decorators/database.decorator';

import { ENUM_MESSAGE_LANGUAGE } from '@common/message/enums/message.enum';
import { IDatabaseDocument } from '@common/database/interfaces/database.interface';
import { ENUM_TERMS_POLICY_TYPE } from '@modules/terms-policy/enums/terms-policy.enum';

const TermsPolicyCollectionName = 'terms_policy';

@DatabaseEntity({
    collection: TermsPolicyCollectionName,
})
export class TermsPolicyEntity extends DatabaseEntityBase {
    @DatabaseProp({
        enum: ENUM_TERMS_POLICY_TYPE,
        type: String,
        required: true,
        index: true,
    })
    type: ENUM_TERMS_POLICY_TYPE;

    @DatabaseProp({ required: true })
    title: string;
    @DatabaseProp({ required: true })
    description: string;
    @DatabaseProp({ required: true })
    content: string;

    @DatabaseProp({
        enum: ENUM_MESSAGE_LANGUAGE,
        type: String,
        required: true,
        index: true,
    })
    language: ENUM_MESSAGE_LANGUAGE;

    @DatabaseProp({
        type: Boolean,
        index: true,
    })
    isPublished: boolean;

    @DatabaseProp({ type: Date })
    publishedAt?: Date;
}

export const TermsPolicySchema = DatabaseSchema(TermsPolicyEntity);
export type TermsPolicyDoc = IDatabaseDocument<TermsPolicyEntity>;

TermsPolicySchema.index(
    { type: 1, language: 1 },
    {
        unique: true,
        partialFilterExpression: { isPublished: true },
        name: 'unique_active_terms_policy',
    }
);