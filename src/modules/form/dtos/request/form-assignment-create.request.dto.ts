import { IsBoolean, IsDate, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class FormAssignmentCreateRequestDto {
    @IsMongoId()
    @IsNotEmpty()
    userId: string;

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
