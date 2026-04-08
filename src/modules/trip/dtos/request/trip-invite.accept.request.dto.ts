import { IsNotEmpty, IsString } from 'class-validator';

export class TripInviteAcceptRequestDto {
    @IsString()
    @IsNotEmpty()
    token: string;
}
