import { AirportUserController } from '@modules/transport/airport/controllers/airport.user.controller';
import { TransportModule } from '@modules/transport/transport.module';
import { UserUserController } from '@modules/user/controllers/user.user.controller';
import { UserModule } from '@modules/user/user.module';
import { Module } from '@nestjs/common';

/**
 * User routes module that provides user-specific endpoints.
 * Contains controllers for user operations that require user-level authentication and authorization.
 */
@Module({
    controllers: [UserUserController, AirportUserController],
    providers: [],
    exports: [],
    imports: [UserModule, TransportModule],
})
export class RoutesUserModule {}
