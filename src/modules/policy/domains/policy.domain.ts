import { PolicyImmutableException } from '@modules/policy/exceptions/policy.immutable.exception';
import { PolicyNotFoundException } from '@modules/policy/exceptions/policy.not-found.exception';
import type { PolicyCreateRequestDto } from '@modules/policy/dtos/request/policy.create.request.dto';
import type { PolicyUpdateRequestDto } from '@modules/policy/dtos/request/policy.update.request.dto';
import { PolicyCache } from '@modules/policy/caches/policy.cache';
import type { IPolicyRule } from '@modules/policy/interfaces/policy.interface';
import { PolicyRepository } from '@modules/policy/repositories/policy.repository';
import type { IRole } from '@modules/role/interfaces/role.interface';
import { EnumRolePlatformKey } from '@modules/role/enums/role.platform-key.enum';
import { ActivityLogDomain } from '@modules/activity-log/domains/activity-log.domain';
import { Injectable } from '@nestjs/common';
import {
    EnumActivityLogAction,
    EnumRoleScope,
} from '@generated/prisma-client/client';
import type { Policy, Prisma } from '@generated/prisma-client/client';

@Injectable()
export class PolicyDomain {
    constructor(
        private readonly policyRepository: PolicyRepository,
        private readonly policyCache: PolicyCache,
        private readonly activityLogDomain: ActivityLogDomain
    ) {}

    private validateRoleWritable(role: IRole): void {
        if (
            role.scope === EnumRoleScope.platform &&
            role.key === EnumRolePlatformKey.superAdmin
        ) {
            throw new PolicyImmutableException();
        }
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async findManyByRole(
        roleId: string,
        additionalWhere?: Prisma.PolicyWhereInput
    ): Promise<Policy[]> {
        return this.policyRepository.findManyByRoleId(roleId, additionalWhere);
    }

    /** Returns the policy rows of every role, read through the policy cache. */
    async findManyByRoleIds(...roleIds: string[]): Promise<IPolicyRule[]> {
        return this.policyCache.getByRoleIdsAndCache(roleIds);
    }

    async createByAdmin(
        role: IRole,
        dto: PolicyCreateRequestDto
    ): Promise<Policy> {
        this.validateRoleWritable(role);

        const events = [
            this.activityLogDomain.prepare({
                action: EnumActivityLogAction.adminPolicyCreate,
            }),
        ];

        const created = await this.policyRepository.create(role.id, dto);
        await this.policyCache.deleteCacheByRoleId(role.id);

        this.activityLogDomain.stagePrepared(events);

        return created;
    }

    async updateByAdmin(
        role: IRole,
        id: string,
        dto: PolicyUpdateRequestDto
    ): Promise<Policy> {
        this.validateRoleWritable(role);

        const stored = await this.policyRepository.findOneByRoleIdAndId(
            role.id,
            id
        );
        if (!stored) {
            throw new PolicyNotFoundException();
        }

        const events = [
            this.activityLogDomain.prepare({
                action: EnumActivityLogAction.adminPolicyUpdate,
            }),
        ];

        const updated = await this.policyRepository.update(id, dto);
        await this.policyCache.deleteCacheByRoleId(role.id);

        this.activityLogDomain.stagePrepared(events);

        return updated;
    }

    async deleteByAdmin(role: IRole, id: string): Promise<Policy> {
        this.validateRoleWritable(role);

        const policyExists = await this.policyRepository.existsByRoleIdAndId(
            role.id,
            id
        );
        if (!policyExists) {
            throw new PolicyNotFoundException();
        }

        const events = [
            this.activityLogDomain.prepare({
                action: EnumActivityLogAction.adminPolicyDelete,
            }),
        ];
        const deleted = await this.policyRepository.delete(id);
        await this.policyCache.deleteCacheByRoleId(role.id);

        this.activityLogDomain.stagePrepared(events);

        return deleted;
    }
}
