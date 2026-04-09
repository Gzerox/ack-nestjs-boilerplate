import { AirportResponseDto } from '@modules/transport/airport/dtos/response/airport.response.dto';
import { Injectable } from '@nestjs/common';
import { Airport } from '@generated/prisma-client';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class AirportUtil {
    mapList(airports: Airport[]): AirportResponseDto[] {
        return plainToInstance(AirportResponseDto, airports);
    }
}
