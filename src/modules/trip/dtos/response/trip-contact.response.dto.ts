import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TenantContactResponseDto } from '@modules/trip/dtos/response/tenant-contact.response.dto';

export class TripContactResponseDto {
    @ApiProperty({
        description: 'Trip-contact link identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    id: string;

    @ApiProperty({ type: () => TenantContactResponseDto, required: true })
    @Type(() => TenantContactResponseDto)
    contact: TenantContactResponseDto;
}
