import { IsDate, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class TripFormCreateFromTemplateRequestDto {
    @IsMongoId()
    @IsNotEmpty()
    templateId: string;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    closesAt?: Date;

    @IsString()
    @IsOptional()
    notes?: string;
}
