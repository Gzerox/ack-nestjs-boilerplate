import { ApiProperty } from '@nestjs/swagger';
import { ProjectMemberInvitationStatusResponseDto } from '@modules/project/dtos/response/project-member-invitation.response.dto';

export class ProjectMemberInviteCreateResponseDto {
    @ApiProperty({
        required: true,
    })
    memberId: string;

    @ApiProperty({
        required: true,
    })
    userId: string;

    @ApiProperty({
        required: true,
    })
    email: string;

    @ApiProperty({
        required: true,
        type: ProjectMemberInvitationStatusResponseDto,
    })
    invitation: ProjectMemberInvitationStatusResponseDto;
}
