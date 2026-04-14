import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma-client';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { ITenantContactService } from '@modules/tenant-contact/interfaces/tenant-contact.service.interface';
import { TenantContactRepository } from '@modules/tenant-contact/repositories/tenant-contact.repository';
import { TenantContactCreateRequestDto } from '@modules/tenant-contact/dtos/request/tenant-contact.create.request.dto';
import { TenantContactUpdateRequestDto } from '@modules/tenant-contact/dtos/request/tenant-contact.update.request.dto';
import { TenantContactResponseDto } from '@modules/tenant-contact/dtos/response/tenant-contact.response.dto';
import { EnumTenantContactStatusCodeError } from '@modules/tenant-contact/enums/tenant-contact.status-code.enum';
import { mapTenantContactToResponseDto } from '@modules/tenant-contact/utils/tenant-contact.util';

@Injectable()
export class TenantContactService implements ITenantContactService {
    constructor(
        private readonly tenantContactRepository: TenantContactRepository
    ) {}

    async getList(
        tenantId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TenantContactSelect,
            Prisma.TenantContactWhereInput
        >
    ): Promise<IResponsePagingReturn<TenantContactResponseDto>> {
        const result = await this.tenantContactRepository.findWithPaginationOffset(pagination, tenantId);
        return {
            ...result,
            data: result.data.map(mapTenantContactToResponseDto),
        };
    }

    async getById(
        contactId: string,
        tenantId: string
    ): Promise<IResponseReturn<TenantContactResponseDto>> {
        const contact = await this.tenantContactRepository.findOneByIdAndTenant(contactId, tenantId);
        if (!contact) {
            throw new NotFoundException({
                statusCode: EnumTenantContactStatusCodeError.notFound,
                message: 'tenantContact.error.notFound',
            });
        }
        if (contact.deletedAt) {
            throw new NotFoundException({
                statusCode: EnumTenantContactStatusCodeError.deleted,
                message: 'tenantContact.error.deleted',
            });
        }

        return { data: mapTenantContactToResponseDto(contact) };
    }

    async create(
        dto: TenantContactCreateRequestDto,
        tenantId: string,
        createdBy: string
    ): Promise<IResponseReturn<TenantContactResponseDto>> {
        const contact = await this.tenantContactRepository.create({
            tenantId,
            createdBy,
            firstName: dto.firstName,
            lastName: dto.lastName,
            category: dto.category,
            phone: dto.phone,
            email: dto.email,
            notes: dto.notes,
        });

        return { data: mapTenantContactToResponseDto(contact) };
    }

    async update(
        contactId: string,
        dto: TenantContactUpdateRequestDto,
        tenantId: string
    ): Promise<IResponseReturn<TenantContactResponseDto>> {
        const existing = await this.tenantContactRepository.findOneByIdAndTenant(contactId, tenantId);
        if (!existing || existing.deletedAt) {
            throw new NotFoundException({
                statusCode: EnumTenantContactStatusCodeError.notFound,
                message: 'tenantContact.error.notFound',
            });
        }

        const updated = await this.tenantContactRepository.update(contactId, {
            firstName: dto.firstName,
            lastName: dto.lastName,
            category: dto.category,
            phone: dto.phone,
            email: dto.email,
            notes: dto.notes,
        });

        return { data: mapTenantContactToResponseDto(updated) };
    }

    async softDelete(
        contactId: string,
        tenantId: string,
        deletedBy: string
    ): Promise<IResponseReturn<void>> {

        await this.tenantContactRepository.softDelete(
            contactId,
            tenantId,
            deletedBy
        );

        return ;
    }
}
