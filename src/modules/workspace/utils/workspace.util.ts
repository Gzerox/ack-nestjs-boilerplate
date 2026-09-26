import type { Workspace } from '@generated/prisma-client/client';
import type {
    IWorkspaceInviteInviter,
    IWorkspaceInvitePreviewSummary,
    IWorkspaceInviteWithRole,
} from '@modules/workspace/interfaces/workspace.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkspaceUtil {
    mapInvitePreview(
        workspace: Workspace,
        invite: IWorkspaceInviteWithRole,
        inviter: IWorkspaceInviteInviter | null
    ): IWorkspaceInvitePreviewSummary {
        return {
            workspaceName: workspace.name,
            inviterName: inviter?.name ?? inviter?.username ?? workspace.name,
            workspaceRole: invite.workspaceRole,
            expiredAt: invite.expiredAt,
        };
    }
}
