import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import type { Prisma } from '@generated/prisma-client/client';
import type { IUserTwoFactor } from '@modules/user/interfaces/user.interface';
import type { IAuthTwoFactorVerifyResult } from '@modules/auth/interfaces/auth.interface';

export interface IUserTwoFactorRepository {
    createDisabledInTx(
        tx: IDatabaseTransactionClient,
        userId: string,
        createdBy: string
    ): Promise<IUserTwoFactor>;
    verifyTwoFactorInTx(
        tx: IDatabaseTransactionClient,
        userId: string,
        verified: IAuthTwoFactorVerifyResult
    ): Promise<boolean>;
    verifyTwoFactor(
        userId: string,
        verified: IAuthTwoFactorVerifyResult
    ): Promise<boolean>;
    setupTwoFactor(
        userId: string,
        pendingSecretEncrypted: string
    ): Promise<IUserTwoFactor>;
    setupTwoFactorConsumingBackupCode(
        userId: string,
        pendingSecretEncrypted: string,
        verified: IAuthTwoFactorVerifyResult
    ): Promise<boolean>;
    enableTwoFactor(
        userId: string,
        secretEncrypted: string,
        backupCodesHashed: string[]
    ): Promise<IUserTwoFactor>;
    disableTwoFactorInTx(
        tx: IDatabaseTransactionClient,
        userId: string
    ): Promise<IUserTwoFactor>;
    regenerateTwoFactorBackupCodes(
        userId: string,
        backupCodesHashed: string[]
    ): Promise<IUserTwoFactor>;
    /** Extra caller-supplied constraint on the owning user, AND-composed first. */
    resetTwoFactorByAdminInTx(
        tx: IDatabaseTransactionClient,
        userId: string,
        additionalWhere: Prisma.UserWhereInput
    ): Promise<IUserTwoFactor | null>;
    increaseTwoFactorAttempt(userId: string): Promise<IUserTwoFactor>;
    resetTwoFactorAttempt(userId: string): Promise<IUserTwoFactor>;
}
