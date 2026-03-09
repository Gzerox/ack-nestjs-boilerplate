import { Module } from '@nestjs/common';
import { AwsModule } from '@common/aws/aws.module';
import { AssetService } from '@common/asset/services/asset.service';
import { AssetRepository } from '@common/asset/repositories/asset.repository';
import { AssetUtil } from '@common/asset/utils/asset.util';
import { HelperModule } from '@common/helper/helper.module';
import { FileModule } from '@common/file/file.module';

@Module({
    imports: [AwsModule, HelperModule, FileModule],
    providers: [AssetService, AssetRepository, AssetUtil],
    exports: [AssetService, AssetUtil],
    controllers: [],
})
export class AssetModule {}
