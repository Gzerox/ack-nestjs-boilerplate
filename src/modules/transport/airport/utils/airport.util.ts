import { AirportResponseDto } from '@modules/transport/airport/dtos/response/airport.response.dto';
import { AirportSearchResponseDto } from '@modules/transport/airport/dtos/response/airport.search.response.dto';
import { Injectable } from '@nestjs/common';
import { Airport } from '@generated/prisma-client';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class AirportUtil {
    mapList(airports: Airport[]): AirportResponseDto[] {
        return plainToInstance(AirportResponseDto, airports);
    }

    mapOne(airport: Airport): AirportResponseDto {
        return plainToInstance(AirportResponseDto, airport);
    }

    mapSearch(
        airports: Pick<
            Airport,
            'id' | 'iataCode' | 'name' | 'city' | 'country' | 'timezone'
        >[]
    ): AirportSearchResponseDto[] {
        return plainToInstance(AirportSearchResponseDto, airports);
    }
}
