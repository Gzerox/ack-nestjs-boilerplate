import { IsArray, IsMongoId } from 'class-validator';

export class TripContactsUpdateRequestDto {
    @IsArray()
    @IsMongoId({ each: true })
    contactIds: string[];
}
