import { AppBaseException } from '@app/exceptions/app.base.exception';
import { AppUnknownException } from '@app/exceptions/app.unknown.exception';
import { DatabaseService } from '@common/database/services/database.service';
import { DatabaseUtil } from '@common/database/utils/database.util';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import type {
    IPaginationIn,
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { ActivityLogDomain } from '@modules/activity-log/domains/activity-log.domain';
import type { IActivityLogStagedEvent } from '@modules/activity-log/interfaces/activity-log.interface';
import { NotificationQueue } from '@modules/notification/queues/notification.queue';
import { TermPolicyContentEmptyException } from '@modules/term-policy/exceptions/term-policy.content-empty.exception';
import { TermPolicyExistException } from '@modules/term-policy/exceptions/term-policy.exist.exception';
import { TermPolicyLanguageDuplicateException } from '@modules/term-policy/exceptions/term-policy.language-duplicate.exception';
import { TermPolicyNotFoundException } from '@modules/term-policy/exceptions/term-policy.not-found.exception';
import { TermPolicyStatusInvalidException } from '@modules/term-policy/exceptions/term-policy.status-invalid.exception';
import type {
    ITermPolicyContentCreate,
    ITermPolicyCreate,
} from '@modules/term-policy/interfaces/term-policy.interface';
import { TermPolicyRepository } from '@modules/term-policy/repositories/term-policy.repository';
import { TermPolicyContentDomain } from '@modules/term-policy/domains/term-policy.content.domain';
import { TermPolicyUtil } from '@modules/term-policy/utils/term-policy.util';
import { UserDomain } from '@modules/user/domains/user.domain';
import { Injectable, Logger } from '@nestjs/common';
import {
    EnumActivityLogAction,
    EnumStorageVisibility,
    EnumTermPolicyStatus,
    Prisma,
} from '@generated/prisma-client/client';
import type { TermPolicy } from '@generated/prisma-client/client';

@Injectable()
export class TermPolicyDomain {
    private readonly logger = new Logger(TermPolicyDomain.name);

    constructor(
        private readonly termPolicyRepository: TermPolicyRepository,
        private readonly objectStorageService: ObjectStorageService,
        private readonly termPolicyUtil: TermPolicyUtil,
        private readonly termPolicyContentDomain: TermPolicyContentDomain,
        private readonly notificationQueue: NotificationQueue,
        private readonly activityLogDomain: ActivityLogDomain,
        private readonly databaseService: DatabaseService,
        private readonly databaseUtil: DatabaseUtil,
        private readonly helperDateService: HelperDateService,
        private readonly userDomain: UserDomain
    ) {}

    private prepareActivityLog(
        action: EnumActivityLogAction,
        termPolicy: Pick<TermPolicy, 'id' | 'type' | 'version'>,
        timestamp: Date
    ): IActivityLogStagedEvent {
        const metadata = this.termPolicyUtil.mapActivityLogMetadata(
            termPolicy,
            timestamp
        );

        return this.activityLogDomain.prepare({
            action,
            metadata,
        });
    }

    private wrapError(err: unknown): AppBaseException {
        if (err instanceof AppBaseException) {
            return err;
        }

        return new AppUnknownException(err);
    }

    private async deletePrefixQuietly(prefix: string): Promise<void> {
        try {
            await this.objectStorageService.deletePrefix(
                EnumStorageVisibility.public,
                prefix
            );
        } catch (error: unknown) {
            this.logger.error(
                error,
                `Failed to delete public term policy objects under ${prefix}`
            );
        }
    }

    async getListByAdmin(
        pagination: IPaginationQueryOffsetParams<Prisma.TermPolicyWhereInput>,
        type?: Record<string, IPaginationIn>,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePaginationReturn<TermPolicy>> {
        return this.termPolicyRepository.find(pagination, type, status);
    }

    async getListPublished(
        pagination: IPaginationQueryCursorParams<Prisma.TermPolicyWhereInput>,
        type?: Record<string, IPaginationIn>
    ): Promise<IResponsePaginationReturn<TermPolicy>> {
        return this.termPolicyRepository.findPublished(pagination, type);
    }

    async createByAdmin({
        contents,
        type,
        version,
    }: ITermPolicyCreate): Promise<TermPolicy> {
        const isExist = await this.termPolicyRepository.existsByVersionAndType(
            version,
            type
        );
        if (isExist) {
            throw new TermPolicyExistException();
        }

        const isUniqueLanguages =
            this.termPolicyUtil.validateUniqueLanguages(contents);
        if (!isUniqueLanguages) {
            throw new TermPolicyLanguageDuplicateException();
        }

        const results = await Promise.allSettled(
            contents.map(upload =>
                this.termPolicyContentDomain.verifyContent(
                    { type, version },
                    upload
                )
            )
        );
        const mappedContents = results
            .filter(
                (
                    result
                ): result is PromiseFulfilledResult<ITermPolicyContentCreate> =>
                    result.status === 'fulfilled'
            )
            .map(result => result.value);
        const rejection = results.find(
            (result): result is PromiseRejectedResult =>
                result.status === 'rejected'
        );
        if (rejection) {
            await Promise.all(
                mappedContents.map(content =>
                    this.objectStorageService.deleteQuietly(content)
                )
            );

            throw rejection.reason;
        }

        let created: TermPolicy;
        try {
            const termPolicyId = this.databaseUtil.createId();
            const timestamp = this.helperDateService.create();
            const events = [
                this.prepareActivityLog(
                    EnumActivityLogAction.adminTermPolicyCreate,
                    { id: termPolicyId, type, version },
                    timestamp
                ),
            ];
            created = await this.termPolicyRepository.create(
                termPolicyId,
                { contents, type, version },
                mappedContents
            );

            this.activityLogDomain.stagePrepared(events);
        } catch (err: unknown) {
            await Promise.all(
                mappedContents.map(content =>
                    this.objectStorageService.deleteQuietly(content)
                )
            );

            const exception = this.wrapError(err);
            throw exception;
        }

        return created;
    }

    async deleteByAdmin(termPolicyId: string): Promise<TermPolicy> {
        const termPolicy =
            await this.termPolicyRepository.findOneById(termPolicyId);
        if (!termPolicy) {
            throw new TermPolicyNotFoundException();
        } else if (termPolicy.status !== EnumTermPolicyStatus.draft) {
            throw new TermPolicyStatusInvalidException();
        }

        let deleted: TermPolicy;
        try {
            const timestamp = this.helperDateService.create();
            const events = [
                this.prepareActivityLog(
                    EnumActivityLogAction.adminTermPolicyDelete,
                    termPolicy,
                    timestamp
                ),
            ];
            deleted = await this.termPolicyRepository.delete(termPolicyId);

            this.activityLogDomain.stagePrepared(events);
        } catch (err: unknown) {
            const exception = this.wrapError(err);
            throw exception;
        }

        const draftPrefix = this.termPolicyUtil.getDraftPrefix(termPolicy);
        await this.deletePrefixQuietly(draftPrefix);

        return deleted;
    }

    async publishByAdmin(
        termPolicyId: string,
        updatedBy: string
    ): Promise<void> {
        const termPolicy =
            await this.termPolicyRepository.findOneById(termPolicyId);
        if (!termPolicy) {
            throw new TermPolicyNotFoundException();
        } else if (termPolicy.status === EnumTermPolicyStatus.published) {
            throw new TermPolicyStatusInvalidException();
        } else if (termPolicy.contents.length === 0) {
            throw new TermPolicyContentEmptyException();
        }

        let events: IActivityLogStagedEvent[];
        try {
            events = await this.databaseService.withTransaction(async tx => {
                const row = await this.termPolicyRepository.publishInTx(
                    tx,
                    termPolicyId
                );
                await this.userDomain.resetTermPolicyForActiveUsersInTx(
                    tx,
                    termPolicy.type
                );

                return [
                    this.prepareActivityLog(
                        EnumActivityLogAction.adminTermPolicyPublish,
                        row,
                        row.updatedAt
                    ),
                ];
            });
        } catch (err: unknown) {
            const exception = this.wrapError(err);
            throw exception;
        }

        this.activityLogDomain.stagePrepared(events);

        try {
            await this.notificationQueue.sendPublishTermPolicy(
                {
                    type: termPolicy.type,
                    version: termPolicy.version,
                },
                updatedBy
            );
        } catch (err: unknown) {
            const exception = this.wrapError(err);
            throw exception;
        }
    }
}
