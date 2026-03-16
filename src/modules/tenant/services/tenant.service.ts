import { DatabaseIdDto } from '@common/database/dtos/database.id.dto';
import { DatabaseUtil } from '@common/database/utils/database.util';
import { HelperService } from '@common/helper/services/helper.service';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { Prisma } from '@generated/prisma-client';
import {
    EnumTenantMemberRole,
    EnumTenantMemberStatus,
} from '@generated/prisma-client';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { EnumAuthStatusCodeError } from '@modules/auth/enums/auth.status-code.enum';
import {
    EnumPolicyAction,
    EnumPolicySubject,
} from '@modules/policy/enums/policy.enum';
import { PolicyService } from '@modules/policy/services/policy.service';
import { RoleAbilityRequestDto } from '@modules/role/dtos/request/role.ability.request.dto';
import {
    TenantMemberRoleAdmin,
    TenantMemberRoleMember,
    TenantMemberRoleOwner,
} from '@modules/tenant/constants/tenant.constant';
import { TenantCreateRequestDto } from '@modules/tenant/dtos/request/tenant.create.request.dto';
import { TenantUpdateSlugRequestDto } from '@modules/tenant/dtos/request/tenant.update-slug.request.dto';
import { TenantUpdateRequestDto } from '@modules/tenant/dtos/request/tenant.update.request.dto';
import { TenantResponseDto } from '@modules/tenant/dtos/response/tenant.response.dto';
import { EnumTenantStatusCodeError } from '@modules/tenant/enums/tenant.status-code.enum';
import {
    ITenant,
    ITenantMember,
} from '@modules/tenant/interfaces/tenant.interface';
import { IRequestAppWithTenant } from '@modules/tenant/interfaces/request.tenant.interface';
import { ITenantService } from '@modules/tenant/interfaces/tenant.service.interface';
import { TenantRepository } from '@modules/tenant/repositories/tenant.repository';
import { TenantUtil } from '@modules/tenant/utils/tenant.util';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';

@Injectable()
export class TenantService implements ITenantService {
    private readonly logger = new Logger(TenantService.name);

    constructor(
        private readonly tenantRepository: TenantRepository,
        private readonly databaseUtil: DatabaseUtil,
        private readonly helperService: HelperService,
        private readonly policyService: PolicyService,
        private readonly tenantUtil: TenantUtil
    ) {}

    async validateTenantGuard(
        request: IRequestAppWithTenant
    ): Promise<ITenant> {
        const tenantId = request.__tenantId;

        if (!tenantId) {
            throw new BadRequestException({
                statusCode: EnumTenantStatusCodeError.xTenantIdRequired,
                message: 'tenant.error.xTenantIdRequired',
            });
        }

        if (!this.databaseUtil.checkIdIsValid(tenantId)) {
            throw new BadRequestException({
                statusCode: EnumTenantStatusCodeError.xTenantIdInvalid,
                message: 'tenant.error.xTenantIdInvalid',
            });
        }

        const tenant = await this.tenantRepository.findOneById(tenantId);
        if (!tenant) {
            throw new NotFoundException({
                statusCode: EnumTenantStatusCodeError.notFound,
                message: 'tenant.error.notFound',
            });
        }

        return tenant;
    }

    async validateTenantMemberGuard(
        request: IRequestAppWithTenant
    ): Promise<ITenantMember> {
        const { user } = request;

        if (!user) {
            throw new ForbiddenException({
                statusCode: EnumAuthStatusCodeError.jwtAccessTokenInvalid,
                message: 'auth.error.accessTokenUnauthorized',
            });
        }

        const tenant = request.__tenant;
        if (!tenant) {
            throw new ForbiddenException({
                statusCode: EnumTenantStatusCodeError.notFound,
                message: 'tenant.error.notFound',
            });
        }

        const tenantMember =
            await this.tenantRepository.findOneActiveMemberByTenantAndUser(
                tenant.id,
                user.userId
            );

        if (!tenantMember) {
            throw new ForbiddenException({
                statusCode: EnumTenantStatusCodeError.memberForbidden,
                message: 'tenant.member.error.forbidden',
            });
        }

        if (
            tenantMember.isJit &&
            tenantMember.expiresAt &&
            tenantMember.expiresAt < this.helperService.dateCreate()
        ) {
            await this.tenantRepository.revokeJitMember(tenantMember.id);

            throw new ForbiddenException({
                statusCode: EnumTenantStatusCodeError.memberForbidden,
                message: 'tenant.member.error.forbidden',
            });
        }

        return tenantMember;
    }

    async validateTenantRoleGuard(
        request: IRequestAppWithTenant,
        requiredRoleNames: string[]
    ): Promise<boolean> {
        const tenantMember = request.__tenantMember;
        if (!tenantMember?.role) {
            throw new ForbiddenException({
                statusCode: EnumTenantStatusCodeError.memberForbidden,
                message: 'tenant.member.error.forbidden',
            });
        }

        if (requiredRoleNames.length === 0) {
            throw new InternalServerErrorException({
                statusCode: EnumTenantStatusCodeError.predefinedRoleNotFound,
                message: 'tenant.role.error.predefinedNotFound',
            });
        }

        if (!requiredRoleNames.includes(tenantMember.role)) {
            throw new ForbiddenException({
                statusCode: EnumTenantStatusCodeError.memberForbidden,
                message: 'tenant.role.error.forbidden',
            });
        }

        return true;
    }

    async validateTenantPermissionGuard(
        request: IRequestAppWithTenant,
        requiredAbilities: RoleAbilityRequestDto[]
    ): Promise<boolean> {
        if (requiredAbilities.length === 0) {
            throw new InternalServerErrorException({
                statusCode: EnumTenantStatusCodeError.predefinedRoleNotFound,
                message: 'tenant.role.error.predefinedNotFound',
            });
        }

        const role = request.__tenantMember?.role;
        const abilities = role ? this.getRoleAbilities(role) : [];

        const abilityRule = this.policyService.createAbility(abilities);
        const isAllowed = this.policyService.hasAbilities(
            abilityRule,
            requiredAbilities
        );

        if (!isAllowed) {
            throw new ForbiddenException({
                statusCode: EnumTenantStatusCodeError.memberForbidden,
                message: 'tenant.role.error.forbidden',
            });
        }

        return true;
    }

    async getListOffset(
        pagination: IPaginationQueryOffsetParams<
            Prisma.TenantSelect,
            Prisma.TenantWhereInput
        >
    ): Promise<IResponsePagingReturn<TenantResponseDto>> {
        const { data, ...others } =
            await this.tenantRepository.findWithPaginationOffset(pagination);

        return {
            ...others,
            data: data.map(tenant => this.tenantUtil.mapTenant(tenant)),
        };
    }

    async getOne(id: string): Promise<IResponseReturn<TenantResponseDto>> {
        const tenant = await this.tenantRepository.findOneById(id);
        if (!tenant) {
            throw new NotFoundException({
                statusCode: EnumTenantStatusCodeError.notFound,
                message: 'tenant.error.notFound',
            });
        }

        return {
            data: this.tenantUtil.mapTenant(tenant),
        };
    }

    async create(
        dto: TenantCreateRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<DatabaseIdDto>> {
        const name = dto.name.trim();
        const slug = await this.generateUniqueSlug(name);
        const tenant = await this.tenantRepository.create({
            name,
            description: dto.description?.trim(),
            slug,
            createdBy,
            updatedBy: createdBy,
        });

        await this.tenantRepository.createMember({
            tenantId: tenant.id,
            userId: createdBy,
            role: EnumTenantMemberRole.owner,
            status: EnumTenantMemberStatus.active,
            createdBy,
            updatedBy: createdBy,
        });

        return {
            data: {
                id: tenant.id,
            },
        };
    }

    async update(
        id: string,
        dto: TenantUpdateRequestDto,
        updatedBy: string
    ): Promise<IResponseReturn<void>> {
        const data: {
            name?: string;
            description?: string;
            updatedBy: string;
        } = { updatedBy };

        if (dto.name !== undefined) {
            const name = dto.name.trim();
            if (name) {
                data.name = name;
            }
        }

        if (dto.description !== undefined) {
            data.description = dto.description.trim();
        }

        if (dto.name === undefined && dto.description === undefined) {
            return {};
        }

        await this.tenantRepository.update(id, data);

        return {};
    }

    async updateSlug(
        id: string,
        dto: TenantUpdateSlugRequestDto,
        updatedBy: string
    ): Promise<IResponseReturn<void>> {
        const slug = this.normalizeSlug(dto.slug);
        const slugOwner = await this.tenantRepository.findOneBySlug(slug);

        if (slugOwner && slugOwner.id !== id) {
            throw new BadRequestException({
                statusCode: EnumTenantStatusCodeError.slugExists,
                message: 'tenant.error.slugExists',
            });
        }

        await this.tenantRepository.update(id, { slug, updatedBy });

        return {};
    }

    async delete(
        id: string,
        deletedBy: string
    ): Promise<IResponseReturn<void>> {
        try {
            await this.tenantRepository.delete(id, deletedBy);
        } catch (error) {
            this.logger.warn(
                `Tenant soft-delete failed [id=${id}, deletedBy=${deletedBy}]: ${error?.message ?? error}`
            );
        }

        return {};
    }

    private normalizeSlug(value: string): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-');
    }

    private async generateUniqueSlug(name: string): Promise<string> {
        const baseSlug = this.normalizeSlug(name) || 'tenant';
        let slug = baseSlug;
        let retry = 0;

        while (await this.tenantRepository.findOneBySlug(slug)) {
            retry += 1;
            slug = `${baseSlug}-${this.helperService.randomString(6).toLowerCase()}`;

            if (retry >= 20) {
                throw new InternalServerErrorException({
                    statusCode: EnumTenantStatusCodeError.slugGenerationFailed,
                    message: 'tenant.error.slugGenerationFailed',
                });
            }
        }

        return slug;
    }

    private getRoleAbilities(role: EnumTenantMemberRole): RoleAbilityRequestDto[] {
        if (role === TenantMemberRoleOwner || role === TenantMemberRoleAdmin) {
            return [
                {
                    subject: EnumPolicySubject.tenant,
                    action: [EnumPolicyAction.read, EnumPolicyAction.update],
                },
                {
                    subject: EnumPolicySubject.tenantMember,
                    action: [
                        EnumPolicyAction.read,
                        EnumPolicyAction.create,
                        EnumPolicyAction.update,
                        EnumPolicyAction.delete,
                    ],
                },
                {
                    subject: EnumPolicySubject.project,
                    action: [
                        EnumPolicyAction.create,
                        EnumPolicyAction.read,
                        EnumPolicyAction.update,
                        EnumPolicyAction.delete,
                    ],
                },
            ];
        }

        if (role === TenantMemberRoleMember) {
            return [
                {
                    subject: EnumPolicySubject.tenant,
                    action: [EnumPolicyAction.read],
                },
                {
                    subject: EnumPolicySubject.tenantMember,
                    action: [EnumPolicyAction.read],
                },
                {
                    subject: EnumPolicySubject.project,
                    action: [
                        EnumPolicyAction.create,
                        EnumPolicyAction.read,
                        EnumPolicyAction.update,
                        EnumPolicyAction.delete,
                    ],
                },
            ];
        }

        return [];
    }
}
