import { AirportUserController } from '@modules/transport/airport/controllers/airport.user.controller';
import { TransportModule } from '@modules/transport/transport.module';
import { UserUserController } from '@modules/user/controllers/user.user.controller';
import { UserModule } from '@modules/user/user.module';
import { FormUserController } from '@modules/form/controllers/form.user.controller';
import { FormModule } from '@modules/form/form.module';
import { TripUserController } from '@modules/trip/controllers/trip.user.controller';
import { TripInviteUserController } from '@modules/trip/controllers/trip-invite.user.controller';
import { TripModule } from '@modules/trip/trip.module';
import { Module } from '@nestjs/common';

/**
 * User routes module that provides user-specific endpoints.
 * Contains controllers for user operations that require user-level authentication and authorization.
 */
@Module({
    controllers: [UserUserController, AirportUserController, FormUserController, TripUserController, TripInviteUserController],
    providers: [],
    exports: [],
    imports: [UserModule, TransportModule, FormModule, TripModule],
})
export class RoutesUserModule {}
