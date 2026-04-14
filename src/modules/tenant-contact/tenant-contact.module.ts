import { Module } from '@nestjs/common';
import { TenantContactRepository } from '@modules/tenant-contact/repositories/tenant-contact.repository';
import { TenantContactService } from '@modules/tenant-contact/services/tenant-contact.service';

@Module({
    providers: [TenantContactService, TenantContactRepository],
    exports: [TenantContactService, TenantContactRepository],
    controllers: [],
})
export class TenantContactModule {}
