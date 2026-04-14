import { Prisma } from '@generated/prisma-client';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { TenantContactResponseDto } from '@modules/tenant-contact/dtos/response/tenant-contact.response.dto';
import { TenantContactCreateRequestDto } from '@modules/tenant-contact/dtos/request/tenant-contact.create.request.dto';
import { TenantContactUpdateRequestDto } from '@modules/tenant-contact/dtos/request/tenant-contact.update.request.dto';

export interface ITenantContactService {
    getList(
        tenantId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TenantContactSelect,
            Prisma.TenantContactWhereInput
        >
    ): Promise<IResponsePagingReturn<TenantContactResponseDto>>;

    getById(
        contactId: string,
        tenantId: string
    ): Promise<IResponseReturn<TenantContactResponseDto>>;

    create(
        dto: TenantContactCreateRequestDto,
        tenantId: string,
        createdBy: string
    ): Promise<IResponseReturn<TenantContactResponseDto>>;

    update(
        contactId: string,
        dto: TenantContactUpdateRequestDto,
        tenantId: string
    ): Promise<IResponseReturn<TenantContactResponseDto>>;

    softDelete(
        contactId: string,
        tenantId: string,
        deletedBy: string
    ): Promise<IResponseReturn<void>>;
}
