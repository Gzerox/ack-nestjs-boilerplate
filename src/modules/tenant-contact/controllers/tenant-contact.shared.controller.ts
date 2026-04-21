import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
    AuthJwtAccessProtected,
    AuthJwtPayload,
} from '@modules/auth/decorators/auth.jwt.decorator';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RequestIsValidUuidPipe } from '@common/request/pipes/request.is-valid-uuid.pipe';
import {
    Response,
    ResponsePaging,
} from '@common/response/decorators/response.decorator';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { ActivityLog } from '@modules/activity-log/decorators/activity-log.decorator';
import { FeatureFlagProtected } from '@modules/feature-flag/decorators/feature-flag.decorator';
import { EnumActivityLogAction, Prisma } from '@generated/prisma-client';
import { PaginationOffsetQuery } from '@common/pagination/decorators/pagination.decorator';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { TenantContactService } from '@modules/tenant-contact/services/tenant-contact.service';
import { TenantContactCreateRequestDto } from '@modules/tenant-contact/dtos/request/tenant-contact.create.request.dto';
import { TenantContactUpdateRequestDto } from '@modules/tenant-contact/dtos/request/tenant-contact.update.request.dto';
import { TenantContactResponseDto } from '@modules/tenant-contact/dtos/response/tenant-contact.response.dto';
import {
    TENANT_CONTACT_TAG_SHARED,
    TenantContactDefaultAvailableSearch,
    TenantContactDefaultAvailableSort,
    TenantContactDefaultPerPage,
} from '@modules/tenant-contact/constants/tenant-contact.constant';
import {
    TenantContactSharedCreateDoc,
    TenantContactSharedDeleteDoc,
    TenantContactSharedGetDoc,
    TenantContactSharedListDoc,
    TenantContactSharedUpdateDoc,
} from '@modules/tenant-contact/docs/tenant-contact.shared.doc';

@ApiTags(TENANT_CONTACT_TAG_SHARED)
@Controller({ version: '1', path: '/contacts' })
export class TenantContactSharedController {
    constructor(private readonly tenantContactService: TenantContactService) {}

    @TenantContactSharedListDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @ResponsePaging('tenantContact.list')
    @Get('/')
    async list(
        @PaginationOffsetQuery({
            availableSearch: TenantContactDefaultAvailableSearch,
            availableOrderBy: TenantContactDefaultAvailableSort,
            defaultPerPage: TenantContactDefaultPerPage,
        })
        pagination: IPaginationQueryOffsetParams<
            Prisma.TenantContactSelect,
            Prisma.TenantContactWhereInput
        >
    ): Promise<IResponsePagingReturn<TenantContactResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tenantContactService.getList(tenantId, pagination);
    }

    @TenantContactSharedGetDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('tenantContact.get')
    @Get('/:idContact')
    async get(
        @Param('idContact', RequestIsValidUuidPipe, RequestRequiredPipe)
        contactId: string
    ): Promise<IResponseReturn<TenantContactResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tenantContactService.getById(contactId, tenantId);
    }

    @TenantContactSharedCreateDoc()
    @ActivityLog(EnumActivityLogAction.adminTenantContactCreate)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('tenantContact.create')
    @HttpCode(HttpStatus.CREATED)
    @Post('/')
    async create(
        @AuthJwtPayload('userId') userId: string,
        @Body() body: TenantContactCreateRequestDto
    ): Promise<IResponseReturn<TenantContactResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tenantContactService.create(body, tenantId, userId);
    }

    @TenantContactSharedUpdateDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('tenantContact.update')
    @Put('/:idContact')
    async update(
        @Param('idContact', RequestIsValidUuidPipe, RequestRequiredPipe)
        contactId: string,
        @Body() body: TenantContactUpdateRequestDto
    ): Promise<IResponseReturn<TenantContactResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tenantContactService.update(contactId, body, tenantId);
    }

    @TenantContactSharedDeleteDoc()
    @ActivityLog(EnumActivityLogAction.adminTenantContactDelete)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('tenantContact.delete')
    @HttpCode(HttpStatus.OK)
    @Delete('/:idContact')
    async softDelete(
        @AuthJwtPayload('userId') userId: string,
        @Param('idContact', RequestIsValidUuidPipe, RequestRequiredPipe)
        contactId: string
    ): Promise<IResponseReturn<void>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tenantContactService.softDelete(contactId, tenantId, userId);
    }
}
