import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { Prisma, TenantContact } from '@generated/prisma-client';
import { HelperService } from '@common/helper/services/helper.service';
import {
    ITenantContactCreate,
    ITenantContactUpdate,
} from '@modules/tenant-contact/interfaces/tenant-contact.interface';

@Injectable()
export class TenantContactRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService,
        private readonly helperService: HelperService
    ) {}

    async findManyActiveByIdsAndTenant(
        contactIds: string[],
        tenantId: string
    ): Promise<TenantContact[]> {
        if (!contactIds.length) {
            return [];
        }

        return this.databaseService.tenantContact.findMany({
            where: {
                id: { in: contactIds },
                tenantId,
                deletedAt: null,
            },
        });
    }

    async findWithPaginationOffset(
        { where, ...params }: IPaginationQueryOffsetParams<
            Prisma.TenantContactSelect,
            Prisma.TenantContactWhereInput
        >,
        tenantId: string
    ): Promise<IResponsePagingReturn<TenantContact>> {
        return this.paginationService.offset<
            TenantContact,
            Prisma.TenantContactSelect,
            Prisma.TenantContactWhereInput
        >(this.databaseService.tenantContact, {
            ...params,
            where: {
                ...where,
                tenantId,
                deletedAt: null,
            },
        });
    }

    async findOneByIdAndTenant(
        contactId: string,
        tenantId: string
    ): Promise<TenantContact | null> {
        return this.databaseService.tenantContact.findFirst({
            where: { id: contactId, tenantId, deletedAt: null },
        });
    }

    async create(data: ITenantContactCreate): Promise<TenantContact> {
        return this.databaseService.tenantContact.create({ data });
    }

    async update(
        contactId: string,
        data: ITenantContactUpdate
    ): Promise<TenantContact> {
        return this.databaseService.tenantContact.update({
            where: { id: contactId },
            data,
        });
    }

    async softDelete(
        id: string,
        tenantId: string,
        deletedBy: string
    ): Promise<TenantContact> {
        return this.databaseService.tenantContact.update({
            where: { id, tenantId },
            data: {
                deletedAt: this.helperService.dateCreate(),
                deletedBy,
            },
        });
    }
}
