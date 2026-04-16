import { DatabaseService } from '@common/database/services/database.service';
import { DatabaseUtil } from '@common/database/utils/database.util';
import { HelperService } from '@common/helper/services/helper.service';
import {
    IPaginationIn,
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IRequestLog } from '@common/request/interfaces/request.interface';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { TermPolicyCreateRequestDto } from '@modules/term-policy/dtos/request/term-policy.create.request.dto';
import { TermPolicyRemoveContentRequestDto } from '@modules/term-policy/dtos/request/term-policy.remove-content.request.dto';
import { TermContentDto } from '@modules/term-policy/dtos/term-policy.content.dto';
import {
    ITermPolicy,
    ITermPolicyUserAcceptance,
} from '@modules/term-policy/interfaces/term-policy.interface';
import { TERM_POLICY_USER_FIELD_MAP } from '@modules/term-policy/constants/term-policy.constant';
import { IUser } from '@modules/user/interfaces/user.interface';
import { Injectable } from '@nestjs/common';
import {
    EnumActivityLogAction,
    EnumTermPolicyStatus,
    EnumTermPolicyType,
    Prisma,
} from '@generated/prisma-client';

@Injectable()
export class TermPolicyRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService,
        private readonly helperService: HelperService,
        private readonly databaseUtil: DatabaseUtil
    ) {}

    async find(
        {
            where,
            ...others
        }: IPaginationQueryOffsetParams<
            Prisma.TermPolicySelect,
            Prisma.TermPolicyWhereInput
        >,
        type?: Record<string, IPaginationIn>,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<ITermPolicy>> {
        return this.paginationService.offset<
            ITermPolicy,
            Prisma.TermPolicySelect,
            Prisma.TermPolicyWhereInput
        >(this.databaseService.termPolicy, {
            ...others,
            where: {
                ...where,
                ...type,
                ...status,
            },
            include: {
                contents: true,
            },
        });
    }

    async findPublished(
        {
            where,
            ...others
        }: IPaginationQueryCursorParams<
            Prisma.TermPolicySelect,
            Prisma.TermPolicyWhereInput
        >,
        type?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<ITermPolicy>> {
        return this.paginationService.cursor<
            ITermPolicy,
            Prisma.TermPolicySelect,
            Prisma.TermPolicyWhereInput
        >(this.databaseService.termPolicy, {
            ...others,
            where: {
                ...where,
                ...type,
                status: EnumTermPolicyStatus.published,
            },
            include: {
                contents: true,
            },
        });
    }

    async findUserAccepted(
        userId: string,
        {
            where,
            ...others
        }: IPaginationQueryCursorParams<
            Prisma.TermPolicyUserAcceptanceSelect,
            Prisma.TermPolicyUserAcceptanceWhereInput
        >
    ): Promise<IResponsePagingReturn<ITermPolicyUserAcceptance>> {
        return this.paginationService.cursor<
            ITermPolicyUserAcceptance,
            Prisma.TermPolicyUserAcceptanceSelect,
            Prisma.TermPolicyUserAcceptanceWhereInput
        >(this.databaseService.termPolicyUserAcceptance, {
            ...others,
            where: {
                userId,
                ...where,
            },
            include: {
                termPolicy: {
                    include: {
                        contents: true,
                    },
                },
                user: true,
            },
        });
    }

    async findOneById(termPolicyId: string): Promise<ITermPolicy | null> {
        return this.databaseService.termPolicy.findUnique({
            where: {
                id: termPolicyId,
            },
            include: {
                contents: true,
            },
        });
    }

    async existLatestPublishedByType(type: EnumTermPolicyType): Promise<{
        id: string;
        type: EnumTermPolicyType;
        version: number;
    } | null> {
        return this.databaseService.termPolicy.findFirst({
            where: {
                type,
                status: EnumTermPolicyStatus.published,
            },
            orderBy: {
                version: Prisma.SortOrder.desc,
            },
            select: {
                id: true,
                type: true,
                version: true,
            },
        });
    }

    async existAcceptanceByPolicyAndUser(
        userId: string,
        termPolicyId: string
    ): Promise<{ id: string } | null> {
        return this.databaseService.termPolicyUserAcceptance.findFirst({
            where: {
                userId,
                termPolicyId,
            },
            select: {
                id: true,
            },
        });
    }

    async existByVersionAndType(
        version: number,
        type: EnumTermPolicyType
    ): Promise<{
        id: string;
        status: EnumTermPolicyStatus;
    } | null> {
        return this.databaseService.termPolicy.findFirst({
            where: {
                version,
                type,
            },
            select: {
                id: true,
                status: true,
            },
        });
    }

    async accept(
        user: IUser,
        termPolicyId: string,
        type: EnumTermPolicyType,
        { ipAddress, userAgent, geoLocation }: IRequestLog
    ): Promise<ITermPolicyUserAcceptance> {
        const acceptedAt = this.helperService.dateCreate();

        const [userAcceptance] = await this.databaseService.$transaction([
            this.databaseService.termPolicyUserAcceptance.create({
                data: {
                    acceptedAt,
                    userId: user.id,
                    termPolicyId,
                    createdBy: user.id,
                },
                include: {
                    termPolicy: {
                        include: {
                            contents: true,
                        },
                    },
                    user: true,
                },
            }),
            this.databaseService.user.update({
                where: {
                    id: user.id,
                    deletedAt: null,
                    status: 'active',
                },
                data: {
                    ...{ [TERM_POLICY_USER_FIELD_MAP[type]]: true },
                    activityLogs: {
                        create: {
                            action: EnumActivityLogAction.userAcceptTermPolicy,
                            ipAddress,
                            userAgent:
                                this.databaseUtil.toPlainObject(userAgent),
                            geoLocation:
                                this.databaseUtil.toPlainObject(geoLocation),
                            createdBy: user.id,
                            metadata: {
                                termPolicyType: type,
                            },
                        },
                    },
                },
            }),
        ]);

        return userAcceptance;
    }

    async create(
        { type, version }: TermPolicyCreateRequestDto,
        contents: TermContentDto[],
        createdBy: string
    ): Promise<ITermPolicy> {
        return this.databaseService.termPolicy.create({
            data: {
                type,
                version,
                status: EnumTermPolicyStatus.draft,
                createdBy,
                contents: {
                    create: contents,
                },
            },
            include: {
                contents: true,
            },
        });
    }

    async delete(termPolicyId: string): Promise<ITermPolicy> {
        return this.databaseService.termPolicy.delete({
            where: {
                id: termPolicyId,
            },
            include: {
                contents: true,
            },
        });
    }

    async updateContent(
        termPolicyId: string,
        content: TermContentDto,
        updatedBy: string
    ): Promise<ITermPolicy> {
        return this.databaseService.$transaction<ITermPolicy>(async tx => {
            await tx.termPolicyContent.update({
                where: {
                    termPolicyId_language: {
                        termPolicyId,
                        language: content.language,
                    },
                },
                data: {
                    language: content.language,
                    bucket: content.bucket,
                    key: content.key,
                    cdnUrl: content.cdnUrl,
                    completedUrl: content.completedUrl,
                    mime: content.mime,
                    extension: content.extension,
                    access: content.access,
                    size: content.size,
                },
            });
            return tx.termPolicy.update({
                where: { id: termPolicyId },
                data: { updatedBy },
                include: { contents: true },
            });
        });
    }

    async addContent(
        termPolicyId: string,
        newContent: TermContentDto,
        updatedBy: string
    ): Promise<ITermPolicy> {
        return this.databaseService.$transaction<ITermPolicy>(async tx => {
            await tx.termPolicyContent.create({
                data: {
                    termPolicyId,
                    language: newContent.language,
                    bucket: newContent.bucket,
                    key: newContent.key,
                    cdnUrl: newContent.cdnUrl,
                    completedUrl: newContent.completedUrl,
                    mime: newContent.mime,
                    extension: newContent.extension,
                    access: newContent.access,
                    size: newContent.size,
                },
            });
            return tx.termPolicy.update({
                where: { id: termPolicyId },
                data: { updatedBy },
                include: { contents: true },
            });
        });
    }

    async removeContent(
        termPolicyId: string,
        { language }: TermPolicyRemoveContentRequestDto,
        updatedBy: string
    ): Promise<ITermPolicy> {
        return this.databaseService.$transaction<ITermPolicy>(async tx => {
            await tx.termPolicyContent.delete({
                where: {
                    termPolicyId_language: {
                        termPolicyId,
                        language,
                    },
                },
            });
            return tx.termPolicy.update({
                where: { id: termPolicyId },
                data: { updatedBy },
                include: { contents: true },
            });
        });
    }

    async publish(
        termPolicyId: string,
        type: EnumTermPolicyType,
        contents: TermContentDto[],
        updatedBy: string
    ): Promise<ITermPolicy> {
        return this.databaseService.$transaction<ITermPolicy>(async tx => {
            for (const content of contents) {
                await tx.termPolicyContent.update({
                    where: {
                        termPolicyId_language: {
                            termPolicyId,
                            language: content.language,
                        },
                    },
                    data: {
                        bucket: content.bucket,
                        key: content.key,
                        cdnUrl: content.cdnUrl,
                        completedUrl: content.completedUrl,
                        mime: content.mime,
                        extension: content.extension,
                        access: content.access,
                        size: content.size,
                    },
                });
            }
            await tx.user.updateMany({
                where: {
                    [TERM_POLICY_USER_FIELD_MAP[type]]: true,
                },
                data: {
                    [TERM_POLICY_USER_FIELD_MAP[type]]: false,
                },
            });
            return tx.termPolicy.update({
                where: { id: termPolicyId },
                data: {
                    status: EnumTermPolicyStatus.published,
                    publishedAt: this.helperService.dateCreate(),
                    updatedBy,
                },
                include: { contents: true },
            });
        });
    }
}
