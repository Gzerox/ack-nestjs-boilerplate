import { ActivityLogSharedController } from '@modules/activity-log/controllers/activity-log.shared.controller';
import { DeviceSharedController } from '@modules/device/controllers/device.shared.controller';
import { DeviceModule } from '@modules/device/device.module';
import { NotificationSharedController } from '@modules/notification/controllers/notification.shared.controller';
import { PasswordHistorySharedController } from '@modules/password-history/controllers/password-history.shared.controller';
import { PasswordHistoryModule } from '@modules/password-history/password-history.module';
import { SessionSharedController } from '@modules/session/controllers/session.shared.controller';
import { TermPolicySharedController } from '@modules/term-policy/controllers/term-policy.shared.controller';
import { UserSharedController } from '@modules/user/controllers/user.shared.controller';
import { UserModule } from '@modules/user/user.module';
import { TripFormSharedController } from '@modules/trip-form/controllers/trip-form.shared.controller';
import { TripFormModule } from '@modules/trip-form/trip-form.module';
import { AirportSharedController } from '@modules/transport/airport/controllers/airport.shared.controller';
import { ItinerarySharedController } from '@modules/transport/itinerary/controllers/itinerary.shared.controller';
import { TransportModule } from '@modules/transport/transport.module';
import { TripSharedController } from '@modules/trip/controllers/trip.shared.controller';
import { TripModule } from '@modules/trip/trip.module';
import { TenantContactSharedController } from '@modules/tenant-contact/controllers/tenant-contact.shared.controller';
import { TenantContactModule } from '@modules/tenant-contact/tenant-contact.module';
import { Module } from '@nestjs/common';

/**
 * Shared routes module providing endpoints accessible by multiple user types.
 * Includes controllers for user management, notifications, sessions, password history,
 * activity logs, term policies, device management, and surveys shared across different access levels.
 */
@Module({
    controllers: [
        UserSharedController,
        PasswordHistorySharedController,
        ActivityLogSharedController,
        SessionSharedController,
        TermPolicySharedController,
        DeviceSharedController,
        NotificationSharedController,
        TripFormSharedController,
        AirportSharedController,
        ItinerarySharedController,
        TripSharedController,
        TenantContactSharedController,
    ],
    providers: [],
    exports: [],
    imports: [UserModule, PasswordHistoryModule, DeviceModule, TripFormModule, TransportModule, TripModule, TenantContactModule],
})
export class RoutesSharedModule {}
