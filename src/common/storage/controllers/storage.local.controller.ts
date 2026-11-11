import {
    Controller,
    Get,
    Header,
    Param,
    Put,
    Req,
    Res,
    StreamableFile,
    VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
    InjectDisk,
    StorageDisk,
    receiveSignedUpload,
    serveFile,
    serveSignedUrl,
} from '@nestjs/storage';
import { EnumStorageVisibility } from '@generated/prisma-client/client';
import { StorageLocalDriverProtected } from '@common/storage/decorators/storage.decorator';
import { StorageKeyPathSchema } from '@common/storage/validations/storage.key-path.validation';
import {
    StorageCrossOriginResourcePolicy,
    StoragePublicCacheControl,
} from '@common/storage/constants/storage.constant';

/**
 * Local-driver delivery routes that make the absolute storage URLs the API returns resolve: public files,
 * signed private downloads, and signed uploads. Not an API endpoint; 404 unless the driver is `local`.
 */
@ApiExcludeController()
@StorageLocalDriverProtected()
@Controller({ path: 'storage', version: VERSION_NEUTRAL })
export class StorageLocalController {
    constructor(
        @InjectDisk(EnumStorageVisibility.public)
        private readonly publicDisk: StorageDisk,
        @InjectDisk(EnumStorageVisibility.private)
        private readonly privateDisk: StorageDisk
    ) {}

    @Header('Cross-Origin-Resource-Policy', StorageCrossOriginResourcePolicy)
    @Get('public/*key')
    async servePublic(
        @Param('key', { schema: StorageKeyPathSchema }) key: string,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<StreamableFile | undefined> {
        return serveFile(this.publicDisk, key, {
            req,
            res,
            disposition: 'inline',
            cacheControl: StoragePublicCacheControl,
        });
    }

    @Header('Cross-Origin-Resource-Policy', StorageCrossOriginResourcePolicy)
    @Get('private')
    async servePrivate(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<StreamableFile | undefined> {
        return serveSignedUrl(this.privateDisk, { req, res });
    }

    @Put('private')
    async receivePrivate(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<void> {
        await receiveSignedUpload(this.privateDisk, { req, res });
    }
}
