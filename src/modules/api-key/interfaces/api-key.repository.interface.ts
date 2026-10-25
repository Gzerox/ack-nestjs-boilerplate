import type {
    IPaginationEqual,
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import type { ApiKeyCreateRequestDto } from '@modules/api-key/dtos/request/api-key.create.request.dto';
import type { ApiKeyUpdateDateRequestDto } from '@modules/api-key/dtos/request/api-key.update-date.request.dto';
import type { ApiKeyUpdateStatusRequestDto } from '@modules/api-key/dtos/request/api-key.update-status.request.dto';
import { Prisma } from '@generated/prisma-client/client';
import type { ApiKey } from '@generated/prisma-client/client';
import type { IApiKeyList } from '@modules/api-key/interfaces/api-key.interface';

export interface IApiKeyRepository {
    /** Extra caller-supplied constraint, AND-composed first. */
    findWithPagination(
        {
            where,
            ...params
        }: IPaginationQueryOffsetParams<Prisma.ApiKeyWhereInput>,
        isActive?: Record<string, IPaginationEqual>,
        type?: Record<string, IPaginationIn>,
        additionalWhere?: Prisma.ApiKeyWhereInput
    ): Promise<IResponsePaginationReturn<IApiKeyList>>;
    create(
        apiKeyId: string,
        { name, type, startAt, endAt }: ApiKeyCreateRequestDto,
        key: string,
        hash: string
    ): Promise<ApiKey>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findOneById(
        id: string,
        additionalWhere?: Prisma.ApiKeyWhereInput
    ): Promise<ApiKey | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    updateStatus(
        id: string,
        { isActive }: ApiKeyUpdateStatusRequestDto,
        additionalWhere?: Prisma.ApiKeyWhereInput
    ): Promise<ApiKey | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    updateName(
        id: string,
        name: string,
        additionalWhere?: Prisma.ApiKeyWhereInput
    ): Promise<ApiKey | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    updateDates(
        id: string,
        { startAt, endAt }: ApiKeyUpdateDateRequestDto,
        additionalWhere?: Prisma.ApiKeyWhereInput
    ): Promise<ApiKey | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    updateHash(
        id: string,
        hash: string,
        additionalWhere?: Prisma.ApiKeyWhereInput
    ): Promise<ApiKey | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    delete(
        id: string,
        additionalWhere?: Prisma.ApiKeyWhereInput
    ): Promise<ApiKey | null>;
    findOneByKey(key: string): Promise<ApiKey | null>;
}
