import { PolicyImmutableException } from '@modules/policy/exceptions/policy.immutable.exception';
import { PolicyRoleScopeSubjectContract } from '@modules/policy/contracts/policy.role-scope-subject.contract';
import { PolicyNonModelSubjects } from '@modules/policy/constants/policy.constant';
import { EnumPolicyInvalidRuleReason } from '@modules/policy/enums/policy.invalid-rule-reason.enum';
import { PolicyInvalidRuleException } from '@modules/policy/exceptions/policy.invalid-rule.exception';
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
    EnumPolicyAction,
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

    /**
     * Structural check of one authored rule against the role scope. Reads only the scope and the
     * rule fields, never an ability. Throws `PolicyInvalidRuleException` with the first failing reason.
     */
    validateRule(
        scope: EnumRoleScope,
        rule: Pick<IPolicyRule, 'subject' | 'action' | 'conditions'>
    ): void {
        if (rule.action.length === 0) {
            throw new PolicyInvalidRuleException(
                EnumPolicyInvalidRuleReason.actionEmpty
            );
        }

        const actions = Object.values<string>(EnumPolicyAction);
        if (rule.action.some(action => !actions.includes(action))) {
            throw new PolicyInvalidRuleException(
                EnumPolicyInvalidRuleReason.actionInvalid
            );
        }

        if (new Set(rule.action).size !== rule.action.length) {
            throw new PolicyInvalidRuleException(
                EnumPolicyInvalidRuleReason.actionDuplicate
            );
        }

        if (!PolicyRoleScopeSubjectContract[scope].includes(rule.subject)) {
            throw new PolicyInvalidRuleException(
                EnumPolicyInvalidRuleReason.roleScopeInvalid
            );
        }

        if (
            rule.conditions !== null &&
            PolicyNonModelSubjects.includes(rule.subject)
        ) {
            throw new PolicyInvalidRuleException(
                EnumPolicyInvalidRuleReason.conditionsNotAllowed
            );
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
        this.validateRule(role.scope, {
            subject: dto.subject,
            action: dto.action,
            conditions: dto.conditions ?? null,
        });

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

        this.validateRule(role.scope, {
            subject: stored.subject,
            action: dto.action,
            conditions: dto.conditions ?? null,
        });

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
