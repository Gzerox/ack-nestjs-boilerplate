import { ApiProperty } from '@nestjs/swagger';
import { ProjectMemberInvitationStatusResponseDto } from '@modules/project/dtos/response/project-member-invitation.response.dto';

export class ProjectMemberInviteSendResponseDto {
    @ApiProperty({
        required: true,
        type: ProjectMemberInvitationStatusResponseDto,
    })
    invitation: ProjectMemberInvitationStatusResponseDto;

    @ApiProperty({
        required: true,
    })
    resendAvailableAt: Date;
}
