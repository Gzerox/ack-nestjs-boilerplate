import { IActivityLogMetadata } from '@modules/activity-log/interfaces/activity-log.interface';
import { RoleAbilitiesResponseDto } from '@modules/role/dtos/response/role.abilities.response.dto';
import { RoleListResponseDto } from '@modules/role/dtos/response/role.list.response.dto';
import { RoleDto } from '@modules/role/dtos/role.dto';
import { Injectable } from '@nestjs/common';
import { Role, RoleAbility } from '@generated/prisma-client';
import { ResponseUtil } from '@common/response/utils/response.util';
import { IRoleWithAbilities } from '@modules/role/interfaces/role.interface';
import {
    EnumPolicyAction,
    EnumPolicySubject,
} from '@modules/policy/enums/policy.enum';
import { RoleAbilityDto } from '@modules/role/dtos/role.ability.dto';

@Injectable()
export class RoleUtil {
    constructor(private readonly responseUtil: ResponseUtil) {}

    mapList(roles: IRoleWithAbilities[]): RoleListResponseDto[] {
        return this.responseUtil.serialize(RoleListResponseDto, roles);
    }

    mapOne(role: IRoleWithAbilities): RoleDto {
        return this.responseUtil.serialize(
            RoleDto,
            this.mapRoleAbilityRows(role)
        );
    }

    mapListAbilities(role: IRoleWithAbilities): RoleAbilitiesResponseDto {
        return this.responseUtil.serialize(RoleAbilitiesResponseDto, {
            abilities: this.groupAbilitiesBySubject(role.abilities),
        });
    }

    mapActivityLogMetadata(role: Role): IActivityLogMetadata {
        return {
            roleId: role.id,
            roleName: role.name,
            roleType: role.type,
            timestamp: role.updatedAt ?? role.createdAt,
        };
    }

    private mapRoleAbilityRows(role: IRoleWithAbilities): Role & {
        abilities: RoleAbilityDto[];
    } {
        return {
            ...role,
            abilities: this.groupAbilitiesBySubject(role.abilities),
        };
    }

    private groupAbilitiesBySubject(abilities: RoleAbility[]): RoleAbilityDto[] {
        const grouped = new Map<EnumPolicySubject, EnumPolicyAction[]>();

        for (const ability of abilities) {
            const subject = ability.subject as EnumPolicySubject;
            const action = ability.action as EnumPolicyAction;
            const actions = grouped.get(subject) ?? [];

            actions.push(action);
            grouped.set(subject, actions);
        }

        return [...grouped.entries()].map(([subject, action]) => ({
            subject,
            action,
        }));
    }
}
