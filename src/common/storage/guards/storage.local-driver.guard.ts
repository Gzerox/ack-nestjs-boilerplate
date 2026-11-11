import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnumStorageDriver } from '@common/storage/enums/storage.enum';
import { StorageObjectNotFoundException } from '@common/storage/exceptions/storage.object-not-found.exception';

/**
 * Lets a local-driver delivery route answer only when `STORAGE_DRIVER` is `local`; every other driver sees a 404.
 */
@Injectable()
export class StorageLocalDriverGuard implements CanActivate {
    private readonly driver: EnumStorageDriver;

    constructor(private readonly configService: ConfigService) {
        this.driver =
            this.configService.get<EnumStorageDriver>('storage.driver')!;
    }

    canActivate(_context: ExecutionContext): boolean {
        if (this.driver !== EnumStorageDriver.local) {
            throw new StorageObjectNotFoundException();
        }

        return true;
    }
}
