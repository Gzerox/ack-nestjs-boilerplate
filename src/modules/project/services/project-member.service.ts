import { DatabaseIdDto } from '@common/database/dtos/database.id.dto';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { IRequestLog } from '@common/request/interfaces/request.interface';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { RoleRepository } from '@modules/role/repositories/role.repository';
import { ProjectMemberCreateRequestDto } from '@modules/project/dtos/request/project-member.create.request.dto';
import { ProjectMemberInviteCreateRequestDto } from '@modules/project/dtos/request/project-member-invite.create.request.dto';
import { ProjectMemberUpdateRequestDto } from '@modules/project/dtos/request/project-member.update.request.dto';
import { ProjectAccessResponseDto } from '@modules/project/dtos/response/project.access.response.dto';
import { ProjectMemberInvitationStatusResponseDto } from '@modules/project/dtos/response/project-member-invitation.response.dto';
import { ProjectMemberInviteCreateResponseDto } from '@modules/project/dtos/response/project-member-invite-create.response.dto';
import { ProjectMemberInviteSendResponseDto } from '@modules/project/dtos/response/project-member-invite-send.response.dto';
import { ProjectMemberResponseDto } from '@modules/project/dtos/response/project-member.response.dto';
import { ProjectResponseDto } from '@modules/project/dtos/response/project.response.dto';
import { ProjectRepository } from '@modules/project/repositories/project.repository';
import { ProjectUtil } from '@modules/project/utils/project.util';
import { UserRepository } from '@modules/user/repositories/user.repository';
import { UserService } from '@modules/user/services/user.service';
import {
    ConflictException,
    ForbiddenException,
    HttpStatus,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    EnumProjectMemberStatus,
    EnumProjectStatus,
    EnumRoleScope,
} from '@prisma/client';

@Injectable()
export class ProjectMemberService {
    constructor(
        private readonly projectRepository: ProjectRepository,
        private readonly roleRepository: RoleRepository,
        private readonly userRepository: UserRepository,
        private readonly userService: UserService,
        private readonly projectUtil: ProjectUtil
    ) {}

    async create(
        projectId: string,
        dto: ProjectMemberCreateRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<DatabaseIdDto>> {
        const [user, member] = await Promise.all([
            this.userRepository.findOneById(dto.userId),
            this.projectRepository.findMemberByProjectAndUser(
                projectId,
                dto.userId
            ),
        ]);

        if (!user) {
            throw new NotFoundException({
                statusCode: HttpStatus.NOT_FOUND,
                message: 'projectMember.error.userNotFound',
            });
        }

        if (member) {
            throw new ConflictException({
                statusCode: HttpStatus.CONFLICT,
                message: 'projectMember.error.exist',
            });
        }

        const role = await this.roleRepository.existByNameAndScope(
            dto.roleName.trim(),
            EnumRoleScope.project
        );
        if (!role) {
            throw new NotFoundException({
                statusCode: HttpStatus.NOT_FOUND,
                message: 'projectRole.error.notFound',
            });
        }

        const projectMember = await this.projectRepository.addMember({
            projectId,
            userId: dto.userId,
            roleId: role.id,
            status: EnumProjectMemberStatus.active,
            createdBy,
            updatedBy: createdBy,
        });

        return {
            data: {
                id: projectMember.id,
            },
        };
    }

    async update(
        projectId: string,
        memberId: string,
        dto: ProjectMemberUpdateRequestDto,
        updatedBy: string
    ): Promise<IResponseReturn<void>> {

        const member = await this.projectRepository.findOneMemberByIdAndProject(
            memberId,
            projectId
        );
        if (!member) {
            throw new ForbiddenException({
                statusCode: HttpStatus.FORBIDDEN,
                message: 'projectMember.error.forbidden',
            });
        }

        let roleId: string | undefined;
        if (dto.roleName !== undefined) {
            const role = await this.roleRepository.existByNameAndScope(
                dto.roleName.trim(),
                EnumRoleScope.project
            );
            if (!role) {
                throw new NotFoundException({
                    statusCode: HttpStatus.NOT_FOUND,
                    message: 'projectRole.error.notFound',
                });
            }
            roleId = role.id;
        }

        if (dto.status === undefined && roleId === undefined) {
            return {};
        }

        await this.projectRepository.updateMember(member.id, {
            roleId,
            status: dto.status,
            updatedBy,
        });

        return {};
    }

    async createInvitation(
        projectId: string,
        dto: ProjectMemberInviteCreateRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<ProjectMemberInviteCreateResponseDto>> {
        const role = await this.roleRepository.existByNameAndScope(
            dto.roleName.trim(),
            EnumRoleScope.project
        );
        if (!role) {
            throw new NotFoundException({
                statusCode: HttpStatus.NOT_FOUND,
                message: 'projectRole.error.notFound',
            });
        }

        const user = await this.userService.resolveOrCreateInvitationUser(
            dto.email,
            createdBy
        );

        const member = await this.projectRepository.findMemberByProjectAndUser(
            projectId,
            user.id
        );
        if (member) {
            throw new ConflictException({
                statusCode: HttpStatus.CONFLICT,
                message: 'projectMember.error.exist',
            });
        }

        const projectMember = await this.projectRepository.addMember({
            projectId,
            userId: user.id,
            roleId: role.id,
            status: EnumProjectMemberStatus.active,
            createdBy,
            updatedBy: createdBy,
        });

        const latestInvitation =
            await this.userRepository.findOneLatestByInvitation(user.id);

        return {
            data: {
                memberId: projectMember.id,
                userId: user.id,
                email: user.email,
                invitation: this.mapInvitationStatus(
                    user.isVerified,
                    user.verifiedAt,
                    latestInvitation
                ),
            },
        };
    }

    async sendInvitation(
        projectId: string,
        memberId: string,
        requestedBy: string,
        requestLog: IRequestLog
    ): Promise<IResponseReturn<ProjectMemberInviteSendResponseDto>> {
        const member = await this.projectRepository.findOneMemberByIdAndProject(
            memberId,
            projectId
        );
        if (!member?.user) {
            throw new NotFoundException({
                statusCode: HttpStatus.NOT_FOUND,
                message: 'projectMember.error.userNotFound',
            });
        }

        const invitation = await this.userService.sendInvitationByUserId(
            member.user.id,
            requestedBy,
            requestLog
        );

        const now = Date.now();
        return {
            data: {
                invitation: {
                    status: 'pending',
                    expiresAt: invitation.expiresAt,
                    remainingSeconds: Math.max(
                        0,
                        Math.floor(
                            (invitation.expiresAt.getTime() - now) / 1000
                        )
                    ),
                    sentAt: new Date(),
                },
                resendAvailableAt: invitation.resendAvailableAt,
            },
        };
    }

    async listMembers(
        projectId: string,
        pagination: IPaginationQueryOffsetParams
    ): Promise<IResponsePagingReturn<ProjectMemberResponseDto>> {
        const { data, ...others } =
            await this.projectRepository.findMembersWithPaginationOffsetByProject(
                projectId,
                pagination
            );

        return {
            ...others,
            data: data.map(member => {
                const user = member.user as typeof member.user & {
                    verifications?: Array<{
                        createdAt?: Date;
                        expiredAt?: Date;
                        isUsed?: boolean;
                        verifiedAt?: Date;
                    }>;
                };

                return this.projectUtil.mapMember(
                    member,
                    this.mapInvitationStatus(
                        member.user?.isVerified ?? false,
                        member.user?.verifiedAt,
                        user?.verifications?.[0]
                    )
                );
            }),
        };
    }

    async list(
        userId: string,
        pagination: IPaginationQueryOffsetParams
    ): Promise<IResponsePagingReturn<ProjectAccessResponseDto>> {
        const { data, ...others } =
            await this.projectRepository.findMembersWithPaginationOffsetByUser(
                userId,
                pagination
            );

        return {
            ...others,
            data: data.map(member =>
                this.projectUtil.mapMemberProjectAccess(member.project)
            ),
        };
    }

    async getOne(
        projectId: string,
        userId: string
    ): Promise<IResponseReturn<ProjectResponseDto>> {

        const member = await this.projectRepository.findMemberByProjectAndUser(
            projectId,
            userId,
            EnumProjectMemberStatus.active
        );

        if (!member?.project) {
            throw new ForbiddenException({
                statusCode: HttpStatus.FORBIDDEN,
                message: 'projectMember.error.forbidden',
            });
        }

        if (member.project.status !== EnumProjectStatus.active) {
            throw new NotFoundException({
                statusCode: HttpStatus.NOT_FOUND,
                message: 'project.error.notFound',
            });
        }

        return {
            data: this.projectUtil.mapProject(member.project),
        };
    }

    private mapInvitationStatus(
        isVerified: boolean,
        verifiedAt?: Date,
        invitation?: {
            createdAt?: Date;
            expiredAt?: Date;
            isUsed?: boolean;
            verifiedAt?: Date;
        }
    ): ProjectMemberInvitationStatusResponseDto {
        if (isVerified) {
            return {
                status: 'completed',
                completedAt: verifiedAt,
            };
        }

        if (!invitation?.expiredAt) {
            return {
                status: 'not_sent',
            };
        }

        if (invitation.isUsed) {
            return {
                status: 'completed',
                completedAt: invitation.verifiedAt ?? verifiedAt,
            };
        }

        const now = Date.now();
        if (invitation.expiredAt.getTime() <= now) {
            return {
                status: 'expired',
                expiresAt: invitation.expiredAt,
                sentAt: invitation.createdAt,
            };
        }

        return {
            status: 'pending',
            expiresAt: invitation.expiredAt,
            sentAt: invitation.createdAt,
            remainingSeconds: Math.max(
                0,
                Math.floor((invitation.expiredAt.getTime() - now) / 1000)
            ),
        };
    }
}
