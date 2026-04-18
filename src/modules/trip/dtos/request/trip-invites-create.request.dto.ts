import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TripInviteCreateRequestDto } from '@modules/trip/dtos/request/trip-invite.create.request.dto';

export class TripInvitesCreateRequestDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripInviteCreateRequestDto)
    invites: TripInviteCreateRequestDto[];
}
