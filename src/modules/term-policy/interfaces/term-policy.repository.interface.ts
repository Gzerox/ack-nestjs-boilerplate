import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import type {
    IPaginationIn,
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import type { TermPolicyCreateRequestDto } from '@modules/term-policy/dtos/request/term-policy.create.request.dto';
import type { TermPolicyRemoveContentRequestDto } from '@modules/term-policy/dtos/request/term-policy.remove-content.request.dto';
import type {
    ITermPolicy,
    ITermPolicyContentCreate,
    ITermPolicyUserAcceptance,
} from '@modules/term-policy/interfaces/term-policy.interface';
import {
    EnumTermPolicyStatus,
    EnumTermPolicyType,
    Prisma,
} from '@generated/prisma-client/client';
import type { TermPolicy } from '@generated/prisma-client/client';

export interface ITermPolicyRepository {
    /** Extra caller-supplied constraint, AND-composed first. */
    find(
        {
            where,
            ...others
        }: IPaginationQueryOffsetParams<Prisma.TermPolicyWhereInput>,
        type: Record<string, IPaginationIn> | undefined,
        status: Record<string, IPaginationIn> | undefined,
        additionalWhere: Prisma.TermPolicyWhereInput
    ): Promise<IResponsePaginationReturn<TermPolicy>>;
    findPublished(
        {
            where,
            ...others
        }: IPaginationQueryCursorParams<Prisma.TermPolicyWhereInput>,
        type?: Record<string, IPaginationIn>
    ): Promise<IResponsePaginationReturn<TermPolicy>>;
    findUserAccepted(
        userId: string,
        {
            where,
            ...others
        }: IPaginationQueryCursorParams<Prisma.TermPolicyUserAcceptanceWhereInput>
    ): Promise<IResponsePaginationReturn<ITermPolicyUserAcceptance>>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findOneById(
        termPolicyId: string,
        additionalWhere: Prisma.TermPolicyWhereInput
    ): Promise<ITermPolicy | null>;
    findLatestPublishedByType(type: EnumTermPolicyType): Promise<{
        id: string;
        type: EnumTermPolicyType;
        version: number;
    } | null>;
    existsAcceptanceByPolicyAndUser(
        userId: string,
        termPolicyId: string
    ): Promise<boolean>;
    existsByVersionAndType(
        version: number,
        type: EnumTermPolicyType
    ): Promise<boolean>;
    findStatusByVersionAndType(
        version: number,
        type: EnumTermPolicyType
    ): Promise<EnumTermPolicyStatus | null>;
    findPublishedByTypesInTx(
        tx: IDatabaseTransactionClient,
        types: EnumTermPolicyType[]
    ): Promise<{ id: string; type: EnumTermPolicyType }[]>;
    acceptInTx(
        tx: IDatabaseTransactionClient,
        userId: string,
        termPolicyId: string,
        createdBy: string,
        acceptedAt: Date
    ): Promise<ITermPolicyUserAcceptance>;
    create(
        termPolicyId: string,
        { type, version }: TermPolicyCreateRequestDto,
        contents: ITermPolicyContentCreate[]
    ): Promise<TermPolicy>;
    /** Extra caller-supplied constraint, AND-composed first. */
    delete(
        termPolicyId: string,
        additionalWhere: Prisma.TermPolicyWhereInput
    ): Promise<TermPolicy | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    updateContent(
        termPolicyId: string,
        content: ITermPolicyContentCreate,
        additionalWhere: Prisma.TermPolicyWhereInput
    ): Promise<TermPolicy | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    addContent(
        termPolicyId: string,
        newContent: ITermPolicyContentCreate,
        additionalWhere: Prisma.TermPolicyWhereInput
    ): Promise<TermPolicy | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    removeContent(
        termPolicyId: string,
        { language }: TermPolicyRemoveContentRequestDto,
        additionalWhere: Prisma.TermPolicyWhereInput
    ): Promise<TermPolicy | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    publishInTx(
        tx: IDatabaseTransactionClient,
        termPolicyId: string,
        contents: ITermPolicyContentCreate[],
        additionalWhere: Prisma.TermPolicyWhereInput
    ): Promise<TermPolicy | null>;
}
