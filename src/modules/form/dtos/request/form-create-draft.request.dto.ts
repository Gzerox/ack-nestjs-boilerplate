import {
    IsArray,
    IsDate,
    IsEnum,
    IsMongoId,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EnumFormKind } from '@generated/prisma-client';
import { FormSchemaSectionRequestDto } from '@modules/form/dtos/request/form-schema.request.dto';

export class FormCreateDraftRequestDto {
    @IsEnum(EnumFormKind)
    @IsNotEmpty()
    kind: EnumFormKind;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    closesAt?: Date;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FormSchemaSectionRequestDto)
    @IsNotEmpty()
    sections: FormSchemaSectionRequestDto[];

    @IsMongoId()
    @IsNotEmpty()
    tripId: string;
}
