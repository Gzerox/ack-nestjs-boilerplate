import { registerAs } from '@nestjs/config';
import ms from 'ms';
import { EnumLoggerLevel } from '@common/logger/enums/logger.enum';

export interface IConfigLogger {
    enable: boolean;
    level: string;
    intoFile: boolean;
    filePath: string;
    auto: boolean;
    prettier: boolean;
    sentry: {
        dsn?: string;
        timeout: number; // in milliseconds
    };
}

export default registerAs(
    'logger',
    (): IConfigLogger => ({
        enable: process.env.LOGGER_ENABLE === 'true',
        level: process.env.LOGGER_LEVEL ?? EnumLoggerLevel.debug,
        intoFile: process.env.LOGGER_INTO_FILE === 'true',
        filePath: '/logs',
        auto: process.env.LOGGER_AUTO === 'true',
        prettier: process.env.LOGGER_PRETTIER === 'true',
        sentry: {
            dsn: process.env.SENTRY_DSN,
            timeout: ms('10s'),
        },
    })
);
