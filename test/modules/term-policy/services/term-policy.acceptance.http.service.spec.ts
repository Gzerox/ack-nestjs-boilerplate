import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { PaginationStoreKey } from '@common/pagination/constants/pagination.constant';
import { EnumPaginationType } from '@common/pagination/enums/pagination.enum';
import { PaginationQueryUtil } from '@common/pagination/utils/pagination.query.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import type { StorageAssetResponseDto } from '@common/storage/dtos/response/storage.asset.response.dto';
import {
    EnumStorageVisibility,
    EnumTermPolicyStatus,
    EnumTermPolicyType,
} from '@generated/prisma-client/client';
import type { UserPhoto } from '@generated/prisma-client/client';
import type { ITermPolicyUserAcceptance } from '@modules/term-policy/interfaces/term-policy.interface';
import { TermPolicyAcceptanceDomain } from '@modules/term-policy/domains/term-policy.acceptance.domain';
import { TermPolicyAcceptanceHttpService } from '@modules/term-policy/services/term-policy.acceptance.http.service';

describe('TermPolicyAcceptanceHttpService', () => {
    const termPolicyAcceptanceDomain: MockProxy<TermPolicyAcceptanceDomain> =
        mock<TermPolicyAcceptanceDomain>();
    const paginationQueryUtil: MockProxy<PaginationQueryUtil> =
        mock<PaginationQueryUtil>();
    const requestStoreService: MockProxy<RequestStoreService> =
        mock<RequestStoreService>();
    const objectStorageService: MockProxy<ObjectStorageService> =
        mock<ObjectStorageService>();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const userPhoto: UserPhoto = {
        id: 'photo-id',
        userId: 'user-id',
        key: 'users/user-id/profile/photo.png',
        visibility: EnumStorageVisibility.public,
        contentType: 'image/png',
        size: BigInt(1024),
        etag: null,
    };
    const photoResponse: StorageAssetResponseDto = {
        key: 'users/user-id/profile/photo.png',
        visibility: EnumStorageVisibility.public,
        contentType: 'image/png',
        url: 'https://cdn.example.com/users/user-id/profile/photo.png',
    };
    const acceptance: ITermPolicyUserAcceptance = {
        id: 'acceptance-id',
        userId: 'user-id',
        termPolicyId: 'term-policy-id',
        acceptedAt: now,
        createdAt: now,
        createdBy: null,
        user: {
            id: 'user-id',
            name: 'User',
            username: 'user',
            photo: userPhoto,
            createdAt: now,
            createdBy: null,
            updatedAt: now,
            updatedBy: null,
            deletedAt: null,
            deletedBy: null,
        },
        termPolicy: {
            id: 'term-policy-id',
            type: EnumTermPolicyType.privacy,
            version: 1,
            status: EnumTermPolicyStatus.published,
            publishedAt: now,
            createdAt: now,
            createdBy: null,
            updatedAt: now,
            updatedBy: null,
        },
    };
    const mappedAcceptance = {
        ...acceptance,
        user: { ...acceptance.user, photo: photoResponse },
    };

    let service: TermPolicyAcceptanceHttpService;

    beforeEach(async () => {
        vi.resetAllMocks();
        objectStorageService.toAssetResponse.mockImplementation(asset => {
            if (asset === userPhoto) {
                return photoResponse;
            }

            return null;
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TermPolicyAcceptanceHttpService,
                {
                    provide: TermPolicyAcceptanceDomain,
                    useValue: termPolicyAcceptanceDomain,
                },
                {
                    provide: PaginationQueryUtil,
                    useValue: paginationQueryUtil,
                },
                {
                    provide: RequestStoreService,
                    useValue: requestStoreService,
                },
                {
                    provide: ObjectStorageService,
                    useValue: objectStorageService,
                },
            ],
        }).compile();

        service = module.get(TermPolicyAcceptanceHttpService);
    });

    describe('getListUserAccepted', () => {
        it('resolves the user photo of every acceptance', async () => {
            paginationQueryUtil.cursor.mockReturnValue({
                params: { limit: 20, orderBy: [] },
                storePatch: { perPage: 20 },
            } as never);
            termPolicyAcceptanceDomain.getListUserAccepted.mockResolvedValue({
                type: EnumPaginationType.cursor,
                perPage: 20,
                hasNext: false,
                data: [acceptance],
            });

            const result = await service.getListUserAccepted('user-id', {});

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                { perPage: 20 }
            );
            expect(result.data).toEqual([mappedAcceptance]);
        });
    });

    describe('mapAcceptance', () => {
        it('resolves the acceptance user photo', () => {
            const result = service['mapAcceptance'](acceptance);

            expect(result).toEqual(mappedAcceptance);
        });
    });
});
