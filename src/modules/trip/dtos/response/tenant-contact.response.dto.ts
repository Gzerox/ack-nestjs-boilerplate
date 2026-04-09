import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { DatabaseDto } from '@common/database/dtos/database.dto';

export class TenantContactResponseDto extends DatabaseDto {
    @ApiProperty({
        description: 'Tenant identifier',
        example: faker.database.mongodbObjectId(),
        required: true,
    })
    tenantId: string;

    @ApiProperty({ example: 'Mario', required: true })
    firstName: string;

    @ApiProperty({ example: 'Rossi', required: true })
    lastName: string;

    @ApiProperty({ example: 'Emergency', required: false })
    category: string | null;

    @ApiProperty({ example: '+390612345678', required: false })
    phoneE164: string | null;

    @ApiProperty({ example: 'support@example.com', required: false })
    email: string | null;

    @ApiProperty({ example: 'Available 24/7', required: false })
    notes: string | null;
}
