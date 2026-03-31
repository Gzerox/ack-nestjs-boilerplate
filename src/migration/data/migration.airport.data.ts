import { EnumAppEnvironment } from '@app/enums/app.enum';
import { EnumAirportStatus } from '@modules/transport/airport/enums/airport.enum';
import { Prisma } from '@generated/prisma-client';

const airportData: Prisma.AirportCreateInput[] = [
    {
        iataCode: 'TQR',
        icaoCode: 'LINI',
        name: 'San Domino Island Heliport',
        city: 'Tremiti Islands',
        country: 'Italy',
        countryCode: 'IT',
        continent: 'Europe',
        continentCode: 'EU',
        timezone: 'Europe/Rome',
        status: EnumAirportStatus.active,
    },
    {
        iataCode: 'CRV',
        icaoCode: 'LIBC',
        name: "Crotone Sant'Anna Pythagoras Airport",
        city: 'Isola di Capo Rizzuto',
        country: 'Italy',
        countryCode: 'IT',
        continent: 'Europe',
        continentCode: 'EU',
        timezone: 'Europe/Rome',
        status: EnumAirportStatus.active,
    },
    {
        iataCode: 'BRI',
        icaoCode: 'LIBD',
        name: 'Bari Karol Wojtyła International Airport',
        city: 'Bari',
        country: 'Italy',
        countryCode: 'IT',
        continent: 'Europe',
        continentCode: 'EU',
        timezone: 'Europe/Rome',
        status: EnumAirportStatus.active,
    },
    {
        iataCode: 'FOG',
        icaoCode: 'LIBF',
        name: 'Foggia Gino Lisa Airport',
        city: 'Foggia',
        country: 'Italy',
        countryCode: 'IT',
        continent: 'Europe',
        continentCode: 'EU',
        timezone: 'Europe/Rome',
        status: EnumAirportStatus.active,
    },
];

export const migrationAirportData: Record<
    EnumAppEnvironment,
    Prisma.AirportCreateInput[]
> = {
    [EnumAppEnvironment.local]: airportData,
    [EnumAppEnvironment.development]: airportData,
    [EnumAppEnvironment.staging]: airportData,
    [EnumAppEnvironment.production]: airportData,
};
