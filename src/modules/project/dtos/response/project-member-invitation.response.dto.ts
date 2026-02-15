import { ApiProperty } from '@nestjs/swagger';

export class ProjectMemberInvitationStatusResponseDto {
    @ApiProperty({
        required: true,
        enum: ['not_sent', 'pending', 'expired', 'completed'],
    })
    status: 'not_sent' | 'pending' | 'expired' | 'completed';

    @ApiProperty({
        required: false,
    })
    expiresAt?: Date;

    @ApiProperty({
        required: false,
        description: 'Seconds remaining before expiration when status is pending',
    })
    remainingSeconds?: number;

    @ApiProperty({
        required: false,
    })
    sentAt?: Date;

    @ApiProperty({
        required: false,
    })
    completedAt?: Date;
}
