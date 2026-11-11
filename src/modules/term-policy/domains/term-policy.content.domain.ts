import { AppBaseException } from '@app/exceptions/app.base.exception';
import { AppUnknownException } from '@app/exceptions/app.unknown.exception';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import { StorageSizeInvalidException } from '@common/storage/exceptions/storage.size-invalid.exception';
import type {
    IStorageSignedUpload,
    IStoredAssetReference,
} from '@common/storage/interfaces/storage.interface';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { ActivityLogDomain } from '@modules/activity-log/domains/activity-log.domain';
import type { IActivityLogStagedEvent } from '@modules/activity-log/interfaces/activity-log.interface';
import { TermPolicyContentType } from '@modules/term-policy/constants/term-policy.constant';
import { TermPolicyContentExistException } from '@modules/term-policy/exceptions/term-policy.content-exist.exception';
import { TermPolicyContentNotFoundException } from '@modules/term-policy/exceptions/term-policy.content-not-found.exception';
import { TermPolicyNotFoundException } from '@modules/term-policy/exceptions/term-policy.not-found.exception';
import { TermPolicyContentSizeExceededException } from '@modules/term-policy/exceptions/term-policy.content-size-exceeded.exception';
import { TermPolicyStatusInvalidException } from '@modules/term-policy/exceptions/term-policy.status-invalid.exception';
import type {
    ITermPolicy,
    ITermPolicyContentAccess,
    ITermPolicyContentCreate,
    ITermPolicyContentPresign,
    ITermPolicyContentUpload,
} from '@modules/term-policy/interfaces/term-policy.interface';
import { TermPolicyRepository } from '@modules/term-policy/repositories/term-policy.repository';
import { TermPolicyUtil } from '@modules/term-policy/utils/term-policy.util';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    EnumActivityLogAction,
    EnumStorageVisibility,
    EnumTermPolicyStatus,
} from '@generated/prisma-client/client';
import type { TermPolicy } from '@generated/prisma-client/client';

@Injectable()
export class TermPolicyContentDomain {
    private readonly logger = new Logger(TermPolicyContentDomain.name);

    private readonly contentMaxSizeInBytes: number;

    constructor(
        private readonly termPolicyRepository: TermPolicyRepository,
        private readonly objectStorageService: ObjectStorageService,
        private readonly termPolicyUtil: TermPolicyUtil,
        private readonly activityLogDomain: ActivityLogDomain,
        private readonly helperDateService: HelperDateService,
        private readonly configService: ConfigService
    ) {
        this.contentMaxSizeInBytes = this.configService.get<number>(
            'termPolicy.content.maxSizeInBytes'
        )!;
    }

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

    private async findOneDraftById(termPolicyId: string): Promise<ITermPolicy> {
        const termPolicy =
            await this.termPolicyRepository.findOneById(termPolicyId);
        if (!termPolicy) {
            throw new TermPolicyNotFoundException();
        } else if (termPolicy.status === EnumTermPolicyStatus.published) {
            throw new TermPolicyStatusInvalidException();
        }

        return termPolicy;
    }

    private async deleteQuietly({
        key,
        visibility,
    }: IStoredAssetReference): Promise<void> {
        try {
            await this.objectStorageService.delete({ key, visibility });
        } catch (error: unknown) {
            this.logger.error(
                error,
                `Failed to delete ${visibility} term policy content object ${key}`
            );
        }
    }

    private wrapError(err: unknown): AppBaseException {
        if (err instanceof AppBaseException) {
            return err;
        }

        return new AppUnknownException(err);
    }

    async deleteObjectsQuietly(assets: IStoredAssetReference[]): Promise<void> {
        await Promise.all(assets.map(asset => this.deleteQuietly(asset)));
    }

    async verifyContent(
        { type, version }: Pick<TermPolicy, 'type' | 'version'>,
        { language, key }: ITermPolicyContentUpload
    ): Promise<ITermPolicyContentCreate> {
        const scopePrefix = this.termPolicyUtil.getContentScopePrefix(
            type,
            version,
            language
        );
        const staged = await this.objectStorageService.verifyUpload(key, {
            scopePrefix,
            maxSizeInBytes: this.contentMaxSizeInBytes,
            contentTypes: [TermPolicyContentType],
            detect: head => this.termPolicyUtil.detectTemplateContentType(head),
        });
        return { ...staged, language };
    }

    async generateContentPresignByAdmin({
        language,
        size,
        type,
        version,
    }: ITermPolicyContentPresign): Promise<IStorageSignedUpload> {
        const status =
            await this.termPolicyRepository.findStatusByVersionAndType(
                version,
                type
            );
        if (status === EnumTermPolicyStatus.published) {
            throw new TermPolicyStatusInvalidException();
        } else if (size < 1) {
            throw new StorageSizeInvalidException();
        } else if (size > this.contentMaxSizeInBytes) {
            throw new TermPolicyContentSizeExceededException();
        }

        const scopePrefix = this.termPolicyUtil.getContentScopePrefix(
            type,
            version,
            language
        );

        return this.objectStorageService.createSignedUpload(scopePrefix, {
            contentType: TermPolicyContentType,
            size,
        });
    }

    async updateContentByAdmin(
        termPolicyId: string,
        upload: ITermPolicyContentUpload
    ): Promise<void> {
        const termPolicy = await this.findOneDraftById(termPolicyId);

        const existingContent = this.termPolicyUtil.getContentByLanguage(
            termPolicy.contents,
            upload.language
        );
        if (!existingContent) {
            throw new TermPolicyContentNotFoundException();
        }

        const content = await this.verifyContent(termPolicy, upload);

        try {
            const timestamp = this.helperDateService.create();
            const events = [
                this.prepareActivityLog(
                    EnumActivityLogAction.adminTermPolicyUpdateContent,
                    termPolicy,
                    timestamp
                ),
            ];
            await this.termPolicyRepository.updateContent(
                termPolicyId,
                content
            );

            this.activityLogDomain.stagePrepared(events);
        } catch (err: unknown) {
            await this.deleteQuietly(content);

            const exception = this.wrapError(err);
            throw exception;
        }

        if (existingContent.key !== content.key) {
            await this.deleteQuietly(existingContent);
        }
    }

    async addContentByAdmin(
        termPolicyId: string,
        upload: ITermPolicyContentUpload
    ): Promise<void> {
        const termPolicy = await this.findOneDraftById(termPolicyId);

        const existingContent = this.termPolicyUtil.getContentByLanguage(
            termPolicy.contents,
            upload.language
        );
        if (existingContent) {
            throw new TermPolicyContentExistException();
        }

        const content = await this.verifyContent(termPolicy, upload);

        try {
            const timestamp = this.helperDateService.create();
            const events = [
                this.prepareActivityLog(
                    EnumActivityLogAction.adminTermPolicyAddContent,
                    termPolicy,
                    timestamp
                ),
            ];
            await this.termPolicyRepository.addContent(termPolicyId, content);

            this.activityLogDomain.stagePrepared(events);
        } catch (err: unknown) {
            await this.deleteQuietly(content);

            const exception = this.wrapError(err);
            throw exception;
        }
    }

    async removeContentByAdmin(
        termPolicyId: string,
        language: EnumMessageLanguage
    ): Promise<void> {
        const termPolicy = await this.findOneDraftById(termPolicyId);

        const existingContent = this.termPolicyUtil.getContentByLanguage(
            termPolicy.contents,
            language
        );
        if (!existingContent) {
            throw new TermPolicyContentNotFoundException();
        }

        try {
            const timestamp = this.helperDateService.create();
            const events = [
                this.prepareActivityLog(
                    EnumActivityLogAction.adminTermPolicyRemoveContent,
                    termPolicy,
                    timestamp
                ),
            ];
            await this.termPolicyRepository.removeContent(termPolicyId, {
                language,
            });

            this.activityLogDomain.stagePrepared(events);
        } catch (err: unknown) {
            const exception = this.wrapError(err);
            throw exception;
        }

        await this.deleteQuietly(existingContent);
    }

    async getContentByAdmin(
        termPolicyId: string,
        language: EnumMessageLanguage
    ): Promise<ITermPolicyContentAccess> {
        const termPolicy =
            await this.termPolicyRepository.findOneById(termPolicyId);
        if (!termPolicy) {
            throw new TermPolicyNotFoundException();
        }

        const existingContent = this.termPolicyUtil.getContentByLanguage(
            termPolicy.contents,
            language
        );
        if (!existingContent) {
            throw new TermPolicyContentNotFoundException();
        }

        const asset: IStoredAssetReference = {
            key: existingContent.key,
            visibility: existingContent.visibility,
        };
        if (asset.visibility === EnumStorageVisibility.public) {
            return { asset, signedDownload: null };
        }

        const filename = this.termPolicyUtil.createContentFilename(
            termPolicy.type,
            termPolicy.version,
            language
        );

        const signedDownload = await this.objectStorageService.signedDownload(
            asset,
            { disposition: 'attachment', filename }
        );

        return { asset, signedDownload };
    }
}
