import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import type {
    Country,
    UserMobileNumber,
} from '@generated/prisma-client/client';
import type {
    IUserMobileNumber,
    IUserMobileNumberInput,
} from '@modules/user/interfaces/user.interface';

export interface IUserMobileNumberRepository {
    findOneMobileNumber(
        userId: string,
        mobileNumberId: string
    ): Promise<{
        id: string;
        number: string;
        phoneCode: string;
        isVerified: boolean;
        verifiedAt: Date | null;
    } | null>;
    existsMobileNumber(
        userId: string,
        { number, countryId, phoneCode }: IUserMobileNumberInput,
        excludeId?: string
    ): Promise<boolean>;
    addInTx(
        tx: IDatabaseTransactionClient,
        userId: string,
        { number, countryId, phoneCode }: IUserMobileNumberInput
    ): Promise<UserMobileNumber & { country: Country }>;
    updateInTx(
        tx: IDatabaseTransactionClient,
        mobileNumberId: string,
        { number, countryId, phoneCode }: IUserMobileNumberInput,
        isVerified: boolean,
        verifiedAt: Date | null
    ): Promise<UserMobileNumber & { country: Country }>;
    markVerifiedInTx(
        tx: IDatabaseTransactionClient,
        mobileNumberId: string,
        number: string,
        phoneCode: string,
        verifiedAt: Date
    ): Promise<IUserMobileNumber | null>;
    deleteInTx(
        tx: IDatabaseTransactionClient,
        mobileNumberId: string
    ): Promise<UserMobileNumber & { country: Country }>;
}
