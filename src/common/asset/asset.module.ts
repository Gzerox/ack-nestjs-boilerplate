import { Module } from '@nestjs/common';
import { AwsModule } from '@common/aws/aws.module';
import { AssetService } from '@common/asset/services/asset.service';
import { AssetRepository } from '@common/asset/repositories/asset.repository';

@Module({
    imports: [AwsModule],
    providers: [AssetService, AssetRepository],
    exports: [AssetService],
    controllers: [],
})
export class AssetModule {}
