import { Prisma } from '@generated/prisma-client/client';
import { PaginationStoreKey } from '@common/pagination/constants/pagination.constant';
import { PaginationQueryUtil } from '@common/pagination/utils/pagination.query.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import type {
    IResponsePaginationReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import {
    SessionCursorAvailableOrderBy,
    SessionDefaultAvailableOrderBy,
} from '@modules/session/constants/session.list.constant';
import type { SessionAdminListRequestDto } from '@modules/session/dtos/request/session.admin-list.request.dto';
import type { SessionSharedListRequestDto } from '@modules/session/dtos/request/session.shared-list.request.dto';
import type { ISessionList } from '@modules/session/interfaces/session.interface';
import { SessionDomain } from '@modules/session/domains/session.domain';
import { Injectable } from '@nestjs/common';
import type { SessionResponseDto } from '@modules/session/dtos/response/session.response.dto';

@Injectable()
export class SessionHttpService {
    constructor(
        private readonly sessionDomain: SessionDomain,
        private readonly paginationQueryUtil: PaginationQueryUtil,
        private readonly requestStoreService: RequestStoreService,
        private readonly objectStorageService: ObjectStorageService
    ) {}

    private mapSession(session: ISessionList): SessionResponseDto {
        const userPhoto = this.objectStorageService.toAssetResponse(
            session.user.photo
        );

        const revokedBy = session.revokedBy
            ? { ...session.revokedBy, photo: null }
            : null;

        return {
            ...session,
            userAgent: session.userAgent as SessionResponseDto['userAgent'],
            geoLocation:
                session.geoLocation as SessionResponseDto['geoLocation'],
            user: { ...session.user, photo: userPhoto },
            revokedBy,
        };
    }

    async getListOffsetByAdmin(
        userId: string,
        query: SessionAdminListRequestDto
    ): Promise<IResponsePaginationReturn<SessionResponseDto>> {
        const { params, storePatch } =
            this.paginationQueryUtil.offset<Prisma.SessionWhereInput>(query, {
                availableOrderBy: SessionDefaultAvailableOrderBy,
            });
        const isRevoked = this.paginationQueryUtil.equalBoolean(
            Prisma.SessionScalarFieldEnum.isRevoked,
            query.isRevoked
        );
        this.requestStoreService.merge(PaginationStoreKey, {
            ...storePatch,
            filters: {
                ...storePatch.filters,
                ...(isRevoked?.storeFilter ?? {}),
            },
        });

        const { data, ...others } =
            await this.sessionDomain.getListOffsetByAdmin(
                userId,
                params,
                isRevoked?.where
            );
        const sessions = data.map(session => this.mapSession(session));

        return {
            data: sessions,
            ...others,
        };
    }

    async getListCursor(
        userId: string,
        query: SessionSharedListRequestDto
    ): Promise<IResponsePaginationReturn<SessionResponseDto>> {
        const { params, storePatch } =
            this.paginationQueryUtil.cursor<Prisma.SessionWhereInput>(query, {
                availableOrderBy: SessionCursorAvailableOrderBy,
            });
        this.requestStoreService.merge(PaginationStoreKey, storePatch);

        const { data, ...others } = await this.sessionDomain.getListCursor(
            userId,
            params
        );
        const sessions = data.map(session => this.mapSession(session));

        return {
            data: sessions,
            ...others,
        };
    }

    async revoke(userId: string, sessionId: string): Promise<void> {
        await this.sessionDomain.revoke(userId, sessionId);

        return;
    }

    async revokeByAdmin(
        userId: string,
        sessionId: string,
        revokedBy: string
    ): Promise<IResponseReturn<void>> {
        await this.sessionDomain.revokeByAdmin(userId, sessionId, revokedBy);

        return {};
    }

    async revokeAllByAdmin(
        userId: string,
        revokedBy: string
    ): Promise<IResponseReturn<void>> {
        await this.sessionDomain.revokeAllByAdmin(userId, revokedBy);

        return {};
    }
}
