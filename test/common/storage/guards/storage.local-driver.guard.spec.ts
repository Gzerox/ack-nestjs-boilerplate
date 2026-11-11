import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { StorageLocalDriverGuard } from '@common/storage/guards/storage.local-driver.guard';
import { EnumStorageDriver } from '@common/storage/enums/storage.enum';
import { EnumStorageStatusCodeError } from '@common/storage/enums/storage.status-code.enum';
import { StorageObjectNotFoundException } from '@common/storage/exceptions/storage.object-not-found.exception';

describe('StorageLocalDriverGuard', () => {
    const configService: MockProxy<ConfigService> = mock<ConfigService>();
    const configGet = vi.mocked(configService.get);
    const context: MockProxy<ExecutionContext> = mock<ExecutionContext>();

    const createGuard = async (
        driver: EnumStorageDriver
    ): Promise<StorageLocalDriverGuard> => {
        configGet.mockReturnValue(driver);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StorageLocalDriverGuard,
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        return module.get(StorageLocalDriverGuard);
    };

    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('canActivate', () => {
        it('allows the request when the driver is local', async () => {
            const guard = await createGuard(EnumStorageDriver.local);

            const result = guard.canActivate(context);

            expect(result).toBe(true);
            expect(configGet).toHaveBeenCalledWith('storage.driver');
        });

        it('throws StorageObjectNotFoundException when the driver is s3', async () => {
            const guard = await createGuard(EnumStorageDriver.s3);

            try {
                guard.canActivate(context);
                throw new Error('expected throw');
            } catch (error) {
                expect(error).toBeInstanceOf(StorageObjectNotFoundException);
                expect(error).toMatchObject({
                    statusCode: EnumStorageStatusCodeError.objectNotFound,
                    messagePath: 'storage.error.objectNotFound',
                });
            }
        });
    });
});
