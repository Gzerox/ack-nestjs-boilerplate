import {
    Doc,
    DocAuth,
    DocGuard,
    DocRequest,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { EnumDocRequestBodyType } from '@common/doc/enums/doc.enum';
import {
    FeatureFlagDocParamsId,
    FeatureFlagDocParamsTargetUser,
    FeatureFlagDocQueryList,
} from '@modules/feature-flag/constants/feature-flag.doc';
import { FeatureFlagTargetUserRequestDto } from '@modules/feature-flag/dtos/request/feature-flag.target-user.request';
import { FeatureFlagUpdateMetadataRequestDto } from '@modules/feature-flag/dtos/request/feature-flag.update-metadata.request';
import { FeatureFlagUpdateStatusRequestDto } from '@modules/feature-flag/dtos/request/feature-flag.update-status.request';
import { FeatureFlagResponseDto } from '@modules/feature-flag/dtos/response/feature-flag.response';
import { applyDecorators } from '@nestjs/common';

export function FeatureFlagAdminListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'admin get all Feature Flags',
        }),
        DocRequest({
            queries: FeatureFlagDocQueryList,
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true, termPolicy: true }),
        DocResponsePaging<FeatureFlagResponseDto>('featureFlag.list', {
            dto: FeatureFlagResponseDto,
        })
    );
}

export function FeatureFlagAdminUpdateStatusDoc(): MethodDecorator {
    return applyDecorators(
        Doc({}),
        DocRequest({
            params: FeatureFlagDocParamsId,
            bodyType: EnumDocRequestBodyType.json,
            dto: FeatureFlagUpdateStatusRequestDto,
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true, termPolicy: true }),
        DocResponse<FeatureFlagResponseDto>('featureFlag.updateStatus', {
            dto: FeatureFlagResponseDto,
        })
    );
}

export function FeatureFlagAdminUpdateMetadataDoc(): MethodDecorator {
    return applyDecorators(
        Doc({}),
        DocRequest({
            params: FeatureFlagDocParamsId,
            bodyType: EnumDocRequestBodyType.json,
            dto: FeatureFlagUpdateMetadataRequestDto,
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true, termPolicy: true }),
        DocResponse<FeatureFlagResponseDto>('featureFlag.updateMetadata', {
            dto: FeatureFlagResponseDto,
        })
    );
}

export function FeatureFlagAdminAddTargetUserDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'admin add target user to Feature Flag',
        }),
        DocRequest({
            params: FeatureFlagDocParamsId,
            bodyType: EnumDocRequestBodyType.json,
            dto: FeatureFlagTargetUserRequestDto,
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true, termPolicy: true }),
        DocResponse<FeatureFlagResponseDto>('featureFlag.addTargetUser', {
            dto: FeatureFlagResponseDto,
        })
    );
}

export function FeatureFlagAdminRemoveTargetUserDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'admin remove target user from Feature Flag',
        }),
        DocRequest({
            params: FeatureFlagDocParamsTargetUser,
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true, termPolicy: true }),
        DocResponse<FeatureFlagResponseDto>('featureFlag.removeTargetUser', {
            dto: FeatureFlagResponseDto,
        })
    );
}
