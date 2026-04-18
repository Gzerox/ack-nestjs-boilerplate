import { ApiProperty } from '@nestjs/swagger';
import { EnumTripInviteIdentifyNextStep } from '@modules/trip/enums/trip-invite-identify-next-step.enum';

export class TripInviteIdentifyResponseDto {
    @ApiProperty({
        enum: EnumTripInviteIdentifyNextStep,
        example: EnumTripInviteIdentifyNextStep.signUp,
        required: true,
        description: 'Next step required by the client auth flow',
    })
    nextStep: EnumTripInviteIdentifyNextStep;
}
