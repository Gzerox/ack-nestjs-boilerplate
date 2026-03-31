import { ApiQueryOptions } from '@nestjs/swagger';

export const AirportDocQuerySearch: ApiQueryOptions[] = [
    {
        name: 'search',
        allowEmptyValue: true,
        required: false,
        type: 'string',
        example: 'MXP',
        description:
            'Search term matched against iataCode, icaoCode, name, city, or country',
    },
    {
        name: 'limit',
        allowEmptyValue: false,
        required: false,
        type: 'number',
        example: 10,
        description: 'Maximum number of results (1–20, default: 10)',
    },
];
