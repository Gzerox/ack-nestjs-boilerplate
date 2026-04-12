import { TransportModule } from '@modules/transport/transport.module';
import { UserUserController } from '@modules/user/controllers/user.user.controller';
import { UserModule } from '@modules/user/user.module';
import { TripFormUserController } from '@modules/trip-form/controllers/trip-form.user.controller';
import { TripFormModule } from '@modules/trip-form/trip-form.module';
import { TripUserController } from '@modules/trip/controllers/trip.user.controller';
import { TripModule } from '@modules/trip/trip.module';
import { Module } from '@nestjs/common';

/**
 * User routes module that provides user-specific endpoints.
 * Contains controllers for user operations that require user-level authentication and authorization.
 */
@Module({
    controllers: [UserUserController, TripFormUserController, TripUserController],
    providers: [],
    exports: [],
    imports: [UserModule, TransportModule, TripFormModule, TripModule],
})
export class RoutesUserModule {}
