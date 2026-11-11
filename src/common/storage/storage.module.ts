import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { StorageModule } from '@nestjs/storage';
import { StorageDiskFactory } from '@common/storage/factories/storage.disk.factory';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { StorageErrorUtil } from '@common/storage/utils/storage.error.util';
import { StorageLocalDriverGuard } from '@common/storage/guards/storage.local-driver.guard';
import { StorageLocalController } from '@common/storage/controllers/storage.local.controller';

/**
 * Registers the named `public` and `private` disks once and exposes `ObjectStorageService` globally, together with
 * the local-driver delivery routes.
 */
@Module({})
export class StorageMainModule {
    static forRoot(): DynamicModule {
        return {
            module: StorageMainModule,
            global: true,
            imports: [
                StorageModule.forRootAsync({
                    isGlobal: false,
                    useClass: StorageDiskFactory,
                }),
            ],
            controllers: [StorageLocalController],
            providers: [
                ObjectStorageService,
                StorageErrorUtil,
                StorageLocalDriverGuard,
            ],
            exports: [ObjectStorageService, StorageErrorUtil],
        };
    }
}
