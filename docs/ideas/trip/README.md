# Trip Domain Implementation

## Purpose

This directory splits the Trip implementation into smaller, topic-focused documents so the aggregate lifecycle, invite workflow, traveler/PII surface, trip contact linkage, visual assets, media, and attachments can evolve independently while staying connected.

All decisions in these files must continue to follow [.claude/CLAUDE.md](../../../.claude/CLAUDE.md).

## Document Map

1. [trip.md](trip.md): aggregate root, draft/publish lifecycle, calendar events, and trip-facing controllers.
2. [trip-invite.md](trip-invite.md): invite issuance, acceptance, revocation, token handling, and invite notification behavior.
3. [trip-traveler.md](trip-traveler.md): traveler grouping, traveler records, trip-scoped traveler documents, and PII-aware traveler endpoints.
4. [../tenant/tenant-contact.md](../tenant/tenant-contact.md): tenant-owned contact book and shared contact-management endpoints.
5. [trip-contact.md](trip-contact.md): trip support-contact linking through `TripContact`.
6. [trip-media.md](trip-media.md): trip media and event-linked media usage using embedded file metadata objects.
7. [trip-attachments.md](trip-attachments.md): trip-specific files, legal material, and other managed attachments using embedded file metadata objects.
8. [trip-form.md](trip-form.md): direct trip-owned forms and traveler assignment rules.
9. [../transport/itinerary.md](../transport/itinerary.md): separate transport itinerary scope.

## Current Scope

The Trip domain currently includes these entities:

1. `Trip`
2. `TripInvite`
3. `TripCalendarEvent`
4. `TripTravelerGroup`
5. `TripTraveler`
6. `TripTravelerDocument`
7. `TripContact`
8. `TripMedia`
9. `TripAttachment`
Trip flows also depend on tenant-owned `TenantContact` records documented in [../tenant/tenant-contact.md](../tenant/tenant-contact.md).

Core capabilities:

1. Create and maintain trips with a `DRAFT -> PUBLISHED -> ARCHIVED` or `CANCELLED` lifecycle.
2. Store optional trip-level visual assets through `icon` and `coverImage`.
3. Manage invitations before or after a user account exists.
4. Resolve accepted invitations into stable `TripTraveler` records.
5. Group invites, travelers, and calendar events through `TripTravelerGroup`.
6. Expose trip details to customers, including `calendarEvents.medias`, support contacts, trip-level media, and trip visuals.
7. Attach tenant-scoped support contacts to trips through `TripContact`.
8. Allow backend users to manage trip-specific attachments during trip setup and edits.
9. Keep direct trip-owned form behavior documented separately from the rest of the trip aggregate.

## Shared Relationships

1. `Trip` is the aggregate root for the full Trip domain.
2. `TripInvite` is the invitation workflow record and may exist before the invitee has an account.
3. `TripTraveler` is the stable per-trip user access record created or reused after invite acceptance.
4. `TripTravelerGroup` is shared by invites, travelers, and calendar events.
5. `TripTravelerDocument` stays trip-scoped and must never be treated as reusable profile data.
6. `TripContact` links a trip to tenant-owned `TenantContact` records that act as support or assistance references for travelers.
7. `Trip.icon` and `Trip.coverImage` are optional trip-level visual assets stored as embedded file metadata objects.
8. `TripMedia` can be attached directly to a trip or to a specific `TripCalendarEvent`, and stores embedded file metadata instead of only a raw URL.
9. `TripAttachment` stores trip-specific files or policy/legal material managed during trip setup, using embedded file metadata when a file is present.
10. Trip-owned forms belong directly to `Trip`; cross-trip reuse happens by copying a form into a new row.

## Reading Order

1. Start with [trip.md](trip.md) for lifecycle, trip creation, publication, and trip-facing APIs.
2. Continue with [trip-invite.md](trip-invite.md) for invitation issuance, acceptance, revocation, and delivery semantics.
3. Continue with [trip-traveler.md](trip-traveler.md) for traveler ownership, document visibility, and PII handling.
4. Use [../tenant/tenant-contact.md](../tenant/tenant-contact.md) for tenant contact management and shared contact endpoints.
5. Use [trip-contact.md](trip-contact.md) for trip contact linking and traveler-facing support references.
6. Use [trip-media.md](trip-media.md) for trip and event media behavior, including embedded file metadata.
7. Use [trip-attachments.md](trip-attachments.md) for trip-level files and legal attachments, including embedded file metadata.
8. Use [trip-form.md](trip-form.md) when direct trip-owned form behavior is in scope.
