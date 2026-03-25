import { IsBoolean, IsDate, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class FormAssignmentCreateRequestDto {
    @IsString()
    @IsIn(['user'])
    @IsNotEmpty()
    audienceType: string;

    @IsMongoId()
    @IsNotEmpty()
    audienceId: string;

    @IsBoolean()
    @IsOptional()
    required?: boolean;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    startsAt?: Date;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    closesAt?: Date;
}
