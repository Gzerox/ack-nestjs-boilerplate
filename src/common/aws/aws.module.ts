import { Module } from '@nestjs/common';
import { AwsS3Service } from '@common/aws/services/aws.s3.service';
import { AwsSESService } from '@common/aws/services/aws.ses.service';
import { AwsSNSService } from '@common/aws/services/aws.sns.service';
import { AwsSocialMessagingService } from '@common/aws/services/aws.social-messaging.service';

/**
 * Provides and exports `AwsS3Service`, `AwsSESService`, `AwsSNSService` and `AwsSocialMessagingService`.
 */
@Module({
    exports: [
        AwsS3Service,
        AwsSESService,
        AwsSNSService,
        AwsSocialMessagingService,
    ],
    providers: [
        AwsS3Service,
        AwsSESService,
        AwsSNSService,
        AwsSocialMessagingService,
    ],
    imports: [],
    controllers: [],
})
export class AwsModule {}
