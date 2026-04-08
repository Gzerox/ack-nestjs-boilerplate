import { IsDate, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class TripInviteCreateRequestDto {
    @IsEmail()
    @IsNotEmpty()
    @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
    email: string;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    expiresAt?: Date;
}
