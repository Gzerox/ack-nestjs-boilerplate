import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import type {
    IPaginationEqual,
    IPaginationIn,
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import type {
    IRole,
    IRoleCreate,
    IRoleUpdate,
    IRoleWithPolicies,
    IRoleWithPolicyCount,
} from '@modules/role/interfaces/role.interface';
import type {
    EnumRoleScope,
    Prisma,
    Role,
} from '@generated/prisma-client/client';

export interface IRoleRepository {
    /** Extra caller-supplied constraint, AND-composed first. */
    findWithPaginationOffsetByAdmin(
        {
            where,
            ...params
        }: IPaginationQueryOffsetParams<Prisma.RoleWhereInput>,
        scope: Record<string, IPaginationIn> | undefined,
        additionalWhere: Prisma.RoleWhereInput
    ): Promise<IResponsePaginationReturn<IRoleWithPolicyCount>>;
    findWithPaginationCursorBySystem(
        {
            where,
            ...params
        }: IPaginationQueryCursorParams<Prisma.RoleWhereInput>,
        scope?: Record<string, IPaginationIn>
    ): Promise<IResponsePaginationReturn<IRoleWithPolicyCount>>;
    findWithPaginationOffsetByShared(
        {
            where,
            ...params
        }: IPaginationQueryOffsetParams<Prisma.RoleWhereInput>,
        scope?: Record<string, IPaginationEqual>
    ): Promise<IResponsePaginationReturn<IRoleWithPolicyCount>>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findOneWithPoliciesById(
        id: string,
        additionalWhere: Prisma.RoleWhereInput
    ): Promise<IRoleWithPolicies | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findOneById(
        id: string,
        additionalWhere: Prisma.RoleWhereInput
    ): Promise<IRole | null>;
    findManyByIds(ids: string[]): Promise<IRole[]>;
    findOneByIdInTx(
        tx: IDatabaseTransactionClient,
        id: string
    ): Promise<IRole | null>;
    findOneByScopeAndKey(
        scope: EnumRoleScope,
        key: string
    ): Promise<IRole | null>;
    findOneByScopeAndKeyInTx(
        tx: IDatabaseTransactionClient,
        scope: EnumRoleScope,
        key: string
    ): Promise<IRole | null>;
    incrementPolicyRevisionInTx(
        tx: IDatabaseTransactionClient,
        roleId: string
    ): Promise<void>;
    existsByScopeAndKey(scope: EnumRoleScope, key: string): Promise<boolean>;
    create(data: IRoleCreate): Promise<IRoleWithPolicies>;
    /** Extra caller-supplied constraint, AND-composed first. */
    update(
        id: string,
        data: IRoleUpdate,
        additionalWhere: Prisma.RoleWhereInput
    ): Promise<IRoleWithPolicies | null>;
    isUsedById(id: string): Promise<boolean>;
    /** Extra caller-supplied constraint, AND-composed first. */
    delete(
        id: string,
        additionalWhere: Prisma.RoleWhereInput
    ): Promise<Role | null>;
}
