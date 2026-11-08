import { Test } from '@nestjs/testing';
import { mock, mockDeep } from 'vitest-mock-extended';
import { DatabaseService } from '@common/database/services/database.service';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { DeviceRepository } from '@modules/device/repositories/device.repository';

describe('DeviceRepository invalid-token cleanup', () => {
    const databaseService = mockDeep<DatabaseService>();
    const helperDateService = mock<HelperDateService>();
    let repository: DeviceRepository;
    beforeEach(async () => {
        vi.resetAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                DeviceRepository,
                { provide: DatabaseService, useValue: databaseService },
                { provide: HelperDateService, useValue: helperDateService },
            ],
        }).compile();
        repository = module.get(DeviceRepository);
    });
    it('clears a device only while its current token is still in the rejected set', async () => {
        databaseService.client.device.updateMany.mockResolvedValue({
            count: 0,
        });
        expect(
            await repository.clearTokens(['device'], 'user', ['rejected-A'])
        ).toEqual({ count: 0 });
        expect(databaseService.client.device.updateMany).toHaveBeenCalledWith({
            where: {
                id: { in: ['device'] },
                notificationToken: { in: ['rejected-A'] },
            },
            data: {
                notificationToken: null,
                notificationProvider: null,
                updatedBy: 'user',
            },
        });
    });
});
