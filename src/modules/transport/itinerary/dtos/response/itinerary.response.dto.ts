import { DatabaseDto } from '@common/database/dtos/database.dto';
import { EnumFlightDirection } from '@generated/prisma-client';

export class ItineraryResponseDto extends DatabaseDto {
    name: string;
    direction: EnumFlightDirection;
}
