import { Module } from '@nestjs/common';
import { AwsSESService } from '@common/aws/services/aws.ses.service';

/**
 * Provides and exports `AwsSESService`.
 */
@Module({
    exports: [AwsSESService],
    providers: [AwsSESService],
    imports: [],
    controllers: [],
})
export class AwsModule {}
