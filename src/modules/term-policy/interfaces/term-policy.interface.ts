import type {
    IStorageSignedDownload,
    IStoredAsset,
    IStoredAssetReference,
} from '@common/storage/interfaces/storage.interface';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import { EnumTermPolicyType } from '@generated/prisma-client/client';
import type {
    TermPolicy,
    TermPolicyContent,
    TermPolicyUserAcceptance,
} from '@generated/prisma-client/client';
import type { IUserRef } from '@modules/user/interfaces/user.interface';

export interface ITermPolicy extends TermPolicy {
    contents: TermPolicyContent[];
}

export interface ITermPolicyUserAcceptance extends TermPolicyUserAcceptance {
    user: IUserRef;
    termPolicy: TermPolicy;
}

export interface ITermPolicyContentUpload {
    language: EnumMessageLanguage;
    key: string;
}

/** The persistable columns of one localized content document — the create/update input shape. */
export interface ITermPolicyContentCreate extends IStoredAsset {
    language: TermPolicyContent['language'];
}

export interface ITermPolicyContentPromoted {
    staged: IStoredAsset;
    content: ITermPolicyContentCreate;
}

export interface ITermPolicyContentAccess {
    asset: IStoredAssetReference;
    signedDownload: IStorageSignedDownload | null;
}

export interface ITermPolicyContentDownload extends Omit<
    IStorageSignedDownload,
    'expiresAt'
> {
    expiresAt: Date | null;
}

export interface ITermPolicyCreate {
    type: EnumTermPolicyType;
    version: number;
    contents: ITermPolicyContentUpload[];
}

export interface ITermPolicyContentPresign {
    type: EnumTermPolicyType;
    version: number;
    language: EnumMessageLanguage;
    size: number;
}

export interface ITermPolicyAcceptanceAnalytic {
    id: string;
    userId: string;
    termPolicyId: string;
    acceptedAt: Date;
    createdAt: Date;
}
